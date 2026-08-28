import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../server/db/prisma";
import type { PnpFileType } from "../config/fileTypes";
import { MAPPING_BY_FILE_TYPE } from "../config/fileMetadata";
import type { ValidationReport } from "../validation/ValidationReport";
import { hasErrors } from "../validation/ValidationReport";
import { persistFatoIndicador, type CachesDeDimensao } from "./persistFatoIndicador";
import { agruparPorAno, calcularDigestAno, type ResumoAno } from "./yearDigest";
import { atualizarProgresso } from "../../server/ingestionProgress";

export interface PersistIngestionBatchInput {
  fileType: PnpFileType;
  originalFilename: string;
  detectedEncoding: string;
  checksum: string;
  rowCount: number;
  validationReport: ValidationReport;
  uploadedByEmail?: string;
  /** Linhas já mapeadas e tipadas, específicas do fileType informado. */
  rows: Record<string, unknown>[];
  /** Identificador de progresso/cancelamento, ver `ingestionProgress`. */
  uploadId?: string;
}

export interface PersistIngestionBatchResult {
  ingestionBatchId: number;
  status: "PERSISTED" | "FAILED_VALIDATION" | "VALIDATED_WITH_WARNINGS";
  /** Presente apenas quando a persistência ocorreu — usado para relatar ao usuário o que mudou. */
  tabelasAfetadas?: {
    deletedFactCount: number;
    insertedFactCount: number;
    instituicaoCount: number;
    unidadeCount: number;
    anosInalterados: number;
    anosGravados: number;
  };
  /** Detalhe por ano-base, para a tela de upload explicar o que foi feito e o que foi pulado. */
  anos?: ResumoAno[];
}

/**
 * Persiste um batch de ingestão de forma **incremental por ano-base**.
 *
 * Os exports da PNP são cumulativos: o arquivo publicado num ano traz também todos os anos
 * anteriores (auditado em 2026-08-28 — os 18 tipos cobrem de 7 a 13 anos cada, e o ano mais recente
 * é só ~13% das linhas). Reimportar o arquivo inteiro reescrevia ~87% de dados idênticos, num único
 * comando de exclusão e uma transação de ~1 milhão de linhas — foi o que fez o kernel matar o MySQL
 * por falta de memória na VM de produção (OOM global; a VM tem 7,8 GB divididos entre todos os
 * serviços e o `innodb_buffer_pool_size` é só 128 MB, então os ~5,7 GB do pico eram memória
 * transitória da própria transação).
 *
 * Agora o conteúdo de cada ano tem um digest (`IngestionYearDigest`): antes de gravar, compara-se o
 * digest do arquivo com o da última importação e **só os anos que realmente mudaram são
 * regravados**. Cada ano é uma transação própria — a memória por transação cai na mesma proporção.
 *
 * A comparação é por conteúdo, não por "qual é o ano mais novo": se a PNP reprocessar e corrigir um
 * ano antigo, aquele ano é reimportado sozinho. Assumir "só importa o ano novo" deixaria uma revisão
 * histórica passar despercebida.
 *
 * **Atomicidade:** a garantia deixou de ser "o arquivo inteiro ou nada" e passou a ser "cada ano
 * inteiro ou nada". Se a importação falhar no meio, os anos já gravados permanecem (cada um
 * consistente e com seu digest atualizado) e os demais ficam como estavam; reenviar o mesmo arquivo
 * retoma exatamente de onde parou, porque os anos já concluídos aparecem como inalterados. O ano é a
 * unidade natural aqui — nenhum cálculo do sistema mistura anos-base dentro de um mesmo indicador.
 */
export async function persistIngestionBatch(
  input: PersistIngestionBatchInput,
  client: PrismaClient = prisma,
): Promise<PersistIngestionBatchResult> {
  const bloqueiaPersistencia = hasErrors(input.validationReport);
  const temAvisos = input.validationReport.issues.length > 0;

  // O registro de auditoria é criado fora das transações por ano, de propósito: se a importação
  // falhar num ano do meio, o batch precisa continuar existindo para registrar a tentativa.
  const batch = await client.ingestionBatch.create({
    data: {
      status: bloqueiaPersistencia ? "FAILED_VALIDATION" : "VALIDATING",
      uploadedByEmail: input.uploadedByEmail,
      originalFilename: input.originalFilename,
      fileType: input.fileType,
      detectedEncoding: input.detectedEncoding,
      checksum: input.checksum,
      rowCount: input.rowCount,
      validationReport: input.validationReport as unknown as Prisma.InputJsonValue,
    },
  });

  if (bloqueiaPersistencia) {
    return { ingestionBatchId: batch.id, status: "FAILED_VALIDATION" };
  }

  const mapping = MAPPING_BY_FILE_TYPE[input.fileType];
  const linhasPorAno = agruparPorAno(input.rows);

  const digestsAtuais = new Map(
    (await client.ingestionYearDigest.findMany({ where: { fileType: input.fileType } })).map((d) => [
      d.ano,
      d.digest,
    ]),
  );

  // Anos que existem no banco mas sumiram do arquivo novo precisam ser removidos para o arquivo
  // continuar sendo a fonte da verdade. Consultado no próprio FatoIndicador (e não só nos digests)
  // para também limpar dados de importações anteriores à existência dos digests.
  const anosNoBanco = (
    await client.fatoIndicador.findMany({
      where: { fileType: input.fileType },
      distinct: ["ano"],
      select: { ano: true },
    })
  ).map((f) => f.ano);

  const anosDoArquivo = new Set(linhasPorAno.keys());
  const anosRemovidos = anosNoBanco.filter((ano) => !anosDoArquivo.has(ano));

  const caches: CachesDeDimensao = { instituicaoIdBySigla: new Map(), unidadeIdByKey: new Map() };
  const resumoAnos: ResumoAno[] = [];
  let deletedFactCount = 0;
  let insertedFactCount = 0;
  let progressoOffset = 0;

  for (const ano of Array.from(linhasPorAno.keys()).sort((a, b) => a - b)) {
    const linhasDoAno = linhasPorAno.get(ano)!;
    const digest = calcularDigestAno(linhasDoAno, mapping);
    const digestAnterior = digestsAtuais.get(ano);

    if (digestAnterior === digest) {
      // Conteúdo idêntico ao da última importação: nada é tocado no banco.
      resumoAnos.push({
        ano,
        resultado: "INALTERADO",
        rowCount: linhasDoAno.length,
        deletedFactCount: 0,
        insertedFactCount: 0,
      });
      progressoOffset += linhasDoAno.length;
      if (input.uploadId) atualizarProgresso(input.uploadId, { processed: progressoOffset });
      continue;
    }

    if (input.uploadId) atualizarProgresso(input.uploadId, { status: "deleting", anoAtual: ano });

    const resultadoDoAno = await client.$transaction(
      async (tx) => {
        const removidos = await tx.fatoIndicador.deleteMany({ where: { fileType: input.fileType, ano } });

        if (input.uploadId) atualizarProgresso(input.uploadId, { status: "persisting", anoAtual: ano });
        const gravados = await persistFatoIndicador(
          tx,
          batch.id,
          input.fileType,
          mapping,
          linhasDoAno,
          input.uploadId,
          caches,
          progressoOffset,
        );

        await tx.ingestionYearDigest.upsert({
          where: { fileType_ano: { fileType: input.fileType, ano } },
          create: {
            fileType: input.fileType,
            ano,
            digest,
            rowCount: linhasDoAno.length,
            factCount: gravados.insertedFactCount,
            ingestionBatchId: batch.id,
          },
          update: {
            digest,
            rowCount: linhasDoAno.length,
            factCount: gravados.insertedFactCount,
            ingestionBatchId: batch.id,
          },
        });

        return { removidos: removidos.count, gravados: gravados.insertedFactCount };
      },
      { timeout: TIMEOUT_TRANSACAO_ANO_MS },
    );

    deletedFactCount += resultadoDoAno.removidos;
    insertedFactCount += resultadoDoAno.gravados;
    progressoOffset += linhasDoAno.length;
    resumoAnos.push({
      ano,
      resultado: digestAnterior === undefined ? "INSERIDO" : "ATUALIZADO",
      rowCount: linhasDoAno.length,
      deletedFactCount: resultadoDoAno.removidos,
      insertedFactCount: resultadoDoAno.gravados,
    });
  }

  for (const ano of anosRemovidos) {
    if (input.uploadId) atualizarProgresso(input.uploadId, { status: "deleting", anoAtual: ano });
    const removidos = await client.$transaction(
      async (tx) => {
        const apagados = await tx.fatoIndicador.deleteMany({ where: { fileType: input.fileType, ano } });
        await tx.ingestionYearDigest.deleteMany({ where: { fileType: input.fileType, ano } });
        return apagados.count;
      },
      { timeout: TIMEOUT_TRANSACAO_ANO_MS },
    );
    deletedFactCount += removidos;
    resumoAnos.push({ ano, resultado: "REMOVIDO", rowCount: 0, deletedFactCount: removidos, insertedFactCount: 0 });
  }

  const status = temAvisos ? "VALIDATED_WITH_WARNINGS" : "PERSISTED";
  await client.ingestionBatch.update({
    where: { id: batch.id },
    data: { status, completedAt: new Date() },
  });

  resumoAnos.sort((a, b) => a.ano - b.ano);

  return {
    ingestionBatchId: batch.id,
    status,
    tabelasAfetadas: {
      deletedFactCount,
      insertedFactCount,
      instituicaoCount: caches.instituicaoIdBySigla.size,
      unidadeCount: caches.unidadeIdByKey.size,
      anosInalterados: resumoAnos.filter((a) => a.resultado === "INALTERADO").length,
      anosGravados: resumoAnos.filter((a) => a.resultado !== "INALTERADO").length,
    },
    anos: resumoAnos,
  };
}

/**
 * Teto por ano, não pelo arquivo inteiro. Um ano do maior arquivo da PNP são ~100 mil fatos, ordens
 * de grandeza abaixo do que justificava os 30 minutos da versão anterior (que processava o arquivo
 * todo numa transação só) — mas a exclusão ainda faz manutenção de índice linha a linha, então a
 * folga continua generosa.
 */
const TIMEOUT_TRANSACAO_ANO_MS = 600_000;
