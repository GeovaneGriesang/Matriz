import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../server/db/prisma";
import type { PnpFileType } from "../config/fileTypes";
import type { ValidationReport } from "../validation/ValidationReport";
import { hasErrors } from "../validation/ValidationReport";
import type { DadosGeraisRow } from "../config/columnMappings/dadosGerais.mapping";
import type { EficienciaAcademicaRow } from "../config/columnMappings/eficienciaAcademica.mapping";
import type { PercentuaisLegaisRow } from "../config/columnMappings/percentuaisLegais.mapping";
import type { SituacaoMatriculaRow } from "../config/columnMappings/situacaoMatricula.mapping";

const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface PersistIngestionBatchInput {
  fileType: PnpFileType;
  originalFilename: string;
  detectedEncoding: string;
  checksum: string;
  rowCount: number;
  validationReport: ValidationReport;
  uploadedByEmail?: string;
  /** Linhas já mapeadas e tipadas, específicas do fileType informado. */
  rows: unknown[];
}

export interface PersistIngestionBatchResult {
  ingestionBatchId: number;
  status: "PERSISTED" | "FAILED_VALIDATION" | "VALIDATED_WITH_WARNINGS";
}

async function upsertDadosGerais(tx: Prisma.TransactionClient, rows: DadosGeraisRow[]): Promise<void> {
  for (const row of rows) {
    const autarquia = await tx.autarquia.upsert({
      where: { sigla: row.siglaAutarquia },
      create: { sigla: row.siglaAutarquia, nome: row.nomeAutarquia },
      update: { nome: row.nomeAutarquia },
    });

    const campus = await tx.campus.upsert({
      where: { codigoPnp: row.codigoCampus },
      create: { codigoPnp: row.codigoCampus, nome: row.nomeCampus, autarquiaId: autarquia.id },
      update: { nome: row.nomeCampus, autarquiaId: autarquia.id },
    });

    await tx.curso.upsert({
      where: { campusId_codigoPnp: { campusId: campus.id, codigoPnp: row.codigoCurso } },
      create: {
        campusId: campus.id,
        codigoPnp: row.codigoCurso,
        nome: row.nomeCurso,
        eixoTecnologico: row.eixoTecnologico as never,
        nivel: row.nivel as never,
        modalidade: row.modalidade as never,
        cnctLabTier: 1,
      },
      update: {
        nome: row.nomeCurso,
        eixoTecnologico: row.eixoTecnologico as never,
        nivel: row.nivel as never,
        modalidade: row.modalidade as never,
      },
    });
  }
}

async function persistSituacaoMatricula(
  tx: Prisma.TransactionClient,
  ingestionBatchId: number,
  rows: SituacaoMatriculaRow[],
): Promise<void> {
  const cursoIdCache = new Map<string, number>();

  const registros = [];
  for (const row of rows) {
    const cacheKey = `${row.codigoCampus}::${row.codigoCurso}`;
    let cursoId = cursoIdCache.get(cacheKey);
    if (cursoId === undefined) {
      const curso = await tx.curso.findFirst({
        where: { codigoPnp: row.codigoCurso, campus: { codigoPnp: row.codigoCampus } },
        select: { id: true },
      });
      if (!curso) {
        throw new Error(
          `Curso "${row.codigoCurso}" do câmpus "${row.codigoCampus}" não encontrado. ` +
            "Ingira o DadosGerais.csv correspondente antes deste arquivo.",
        );
      }
      cursoId = curso.id;
      cursoIdCache.set(cacheKey, cursoId);
    }

    registros.push({
      cursoId,
      ingestionBatchId,
      matriculaEquivalente: row.matriculaEquivalente,
      situacao: row.situacao,
      dataIngressoCiclo: row.dataIngressoCiclo,
      dataReferencia: row.dataReferencia,
    });
  }

  for (const parte of chunk(registros, CHUNK_SIZE)) {
    await tx.matricula.createMany({ data: parte });
  }
}

async function resolveCampusIdsByCodigo(
  tx: Prisma.TransactionClient,
  codigosCampus: string[],
): Promise<Map<string, number>> {
  const campi = await tx.campus.findMany({
    where: { codigoPnp: { in: Array.from(new Set(codigosCampus)) } },
    select: { id: true, codigoPnp: true },
  });
  return new Map(campi.map((c) => [c.codigoPnp, c.id]));
}

async function persistEficienciaAcademica(
  tx: Prisma.TransactionClient,
  ingestionBatchId: number,
  rows: EficienciaAcademicaRow[],
): Promise<void> {
  const campusIdByCodigo = await resolveCampusIdsByCodigo(tx, rows.map((r) => r.codigoCampus));

  const registros = rows.map((row) => {
    const campusId = campusIdByCodigo.get(row.codigoCampus);
    if (campusId === undefined) {
      throw new Error(`Câmpus "${row.codigoCampus}" não encontrado. Ingira o DadosGerais.csv primeiro.`);
    }
    return {
      campusId,
      ingestionBatchId,
      tipo: "IEA" as const,
      valor: row.valorIea,
      referenciaAno: row.referenciaAno,
    };
  });

  for (const parte of chunk(registros, CHUNK_SIZE)) {
    await tx.indicadorCampus.createMany({ data: parte });
  }
}

async function persistPercentuaisLegais(
  tx: Prisma.TransactionClient,
  ingestionBatchId: number,
  rows: PercentuaisLegaisRow[],
): Promise<void> {
  const campusIdByCodigo = await resolveCampusIdsByCodigo(tx, rows.map((r) => r.codigoCampus));

  const registros = rows.flatMap((row) => {
    const campusId = campusIdByCodigo.get(row.codigoCampus);
    if (campusId === undefined) {
      throw new Error(`Câmpus "${row.codigoCampus}" não encontrado. Ingira o DadosGerais.csv primeiro.`);
    }
    return [
      {
        campusId,
        ingestionBatchId,
        tipo: "IAPL_TECNICOS" as const,
        valor: row.matriculasTecnicos,
        referenciaAno: row.referenciaAno,
      },
      {
        campusId,
        ingestionBatchId,
        tipo: "IAPL_FORMACAO_PROFESSORES" as const,
        valor: row.matriculasFormacaoProfessores,
        referenciaAno: row.referenciaAno,
      },
      {
        campusId,
        ingestionBatchId,
        tipo: "IAPL_PROEJA" as const,
        valor: row.matriculasProeja,
        referenciaAno: row.referenciaAno,
      },
    ];
  });

  for (const parte of chunk(registros, CHUNK_SIZE)) {
    await tx.indicadorCampus.createMany({ data: parte });
  }
}

/**
 * Persiste um batch de ingestão dentro de uma única transação: cria o registro
 * de auditoria (`IngestionBatch`) e, se a validação não tiver ERROS, grava as
 * linhas de fato/referência correspondentes ao tipo de arquivo. Qualquer falha
 * durante a gravação reverte a transação inteira.
 *
 * RELACAO_ALUNO_PROFESSOR_RAP e CLASSIFICACAO_RACIAL_RENDA_SEXO são validados e
 * o batch é registrado, mas a gravação de linhas de fato para esses dois tipos
 * fica pendente até a estrutura real das colunas da PNP ser confirmada (ver
 * Pendências do plano de M1).
 */
export async function persistIngestionBatch(
  input: PersistIngestionBatchInput,
  client: PrismaClient = prisma,
): Promise<PersistIngestionBatchResult> {
  const bloqueiaPersistencia = hasErrors(input.validationReport);
  const temAvisos = input.validationReport.issues.length > 0;

  return client.$transaction(async (tx) => {
    const batch = await tx.ingestionBatch.create({
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

    switch (input.fileType) {
      case "DADOS_GERAIS":
        await upsertDadosGerais(tx, input.rows as DadosGeraisRow[]);
        break;
      case "SITUACAO_MATRICULA":
        await persistSituacaoMatricula(tx, batch.id, input.rows as SituacaoMatriculaRow[]);
        break;
      case "EFICIENCIA_ACADEMICA":
        await persistEficienciaAcademica(tx, batch.id, input.rows as EficienciaAcademicaRow[]);
        break;
      case "PERCENTUAIS_LEGAIS":
        await persistPercentuaisLegais(tx, batch.id, input.rows as PercentuaisLegaisRow[]);
        break;
      case "RELACAO_ALUNO_PROFESSOR_RAP":
      case "CLASSIFICACAO_RACIAL_RENDA_SEXO":
        // Gravação de linhas de fato pendente — ver comentário da função.
        break;
    }

    const status = temAvisos ? "VALIDATED_WITH_WARNINGS" : "PERSISTED";
    await tx.ingestionBatch.update({
      where: { id: batch.id },
      data: { status, completedAt: new Date() },
    });

    return { ingestionBatchId: batch.id, status };
  });
}
