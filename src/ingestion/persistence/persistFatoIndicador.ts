import type { Prisma } from "@prisma/client";
import type { ColumnMapping } from "../config/mappingTypes";
import type { PnpFileType } from "../config/fileTypes";
import { atualizarProgresso, cancelamentoFoiSolicitado } from "../../server/ingestionProgress";
import { IngestionCancelledError } from "../errors";

/**
 * Exports reais da PNP podem ter dezenas de milhares de linhas. Cada chunk
 * vira uma ida-e-volta de rede dentro da transação interativa do Prisma —
 * poucas linhas por chunk multiplicam esse round-trip e estouram o timeout
 * da transação em arquivos grandes, então usamos um lote maior aqui.
 */
const CHUNK_SIZE = 5_000;

/**
 * Campos de dimensão que viram coluna própria (FK/escalar) em vez de entrar em `dimensoesExtra`.
 * Exportado porque `scripts/generatePnpViews.ts` precisa do mesmo critério para saber quais campos
 * de cada mapeamento vêm de `dimensoesExtra` (JSON) ao gerar as views SQL — nunca duplicar esta
 * lista lá, importar daqui.
 */
/**
 * Caches de Instituição/Unidade já resolvidas, compartilháveis entre chamadas. Na importação
 * incremental esta função é chamada uma vez por ano, cada uma em sua própria transação; sem
 * compartilhar os caches, os mesmos ~64 institutos e ~669 câmpus seriam resolvidos de novo a cada
 * ano. Os IDs continuam válidos entre transações porque já foram commitados.
 */
export interface CachesDeDimensao {
  instituicaoIdBySigla: Map<string, number>;
  unidadeIdByKey: Map<string, number>;
}

export const CORE_DIMENSION_FIELDS = new Set([
  "ano",
  "regiao",
  "uf",
  "estado",
  "organizacaoAcademica",
  "instituicaoSigla",
  "instituicaoNome",
  "unidadeNome",
]);

/**
 * Persiste as linhas já mapeadas/validadas de um batch como fatos genéricos:
 * resolve (upsert inline, sem depender de outro arquivo já ter sido
 * ingerido) a Instituição e a Unidade de cada linha, e grava uma
 * `FatoIndicador` por coluna `kind: "measure"` com valor não-nulo.
 */
export async function persistFatoIndicador(
  tx: Prisma.TransactionClient,
  ingestionBatchId: number,
  fileType: PnpFileType,
  mapping: ColumnMapping<Record<string, unknown>>,
  rows: Record<string, unknown>[],
  uploadId?: string,
  caches?: CachesDeDimensao,
  progressoOffset = 0,
): Promise<{ insertedFactCount: number; instituicaoCount: number; unidadeCount: number }> {
  const instituicaoIdBySigla = caches?.instituicaoIdBySigla ?? new Map<string, number>();
  const unidadeIdByKey = caches?.unidadeIdByKey ?? new Map<string, number>();

  const dimensionFields = Object.entries(mapping.columns).filter(([, def]) => def.kind === "dimension");
  const extraDimensionFields = dimensionFields.filter(([field]) => !CORE_DIMENSION_FIELDS.has(field));
  const measureFields = Object.entries(mapping.columns).filter(([, def]) => def.kind === "measure");

  // Buffer de no máximo CHUNK_SIZE fatos: cada vez que enche, é gravado e esvaziado. Antes este
  // array acumulava TODOS os fatos do arquivo antes do primeiro INSERT — num DadosGerais.csv real
  // são 521 mil fatos e ~93 MB só do JSON de `dimensoesExtra`. Gravando enquanto lê, o uso de
  // memória do Node fica constante (pico medido de 198 MB numa importação completa), o que importa
  // porque a VM de produção divide 7,8 GB entre todos os serviços e já teve o MySQL morto pelo OOM
  // killer durante uma importação — ver o comentário em persistIngestionBatch.ts.
  let buffer: Prisma.FatoIndicadorCreateManyInput[] = [];
  let insertedFactCount = 0;

  const gravarBuffer = async () => {
    if (buffer.length === 0) return;
    if (uploadId && cancelamentoFoiSolicitado(uploadId)) {
      throw new IngestionCancelledError();
    }
    await tx.fatoIndicador.createMany({ data: buffer });
    insertedFactCount += buffer.length;
    buffer = [];
  };

  let linhasProcessadas = 0;
  for (const row of rows) {
    const sigla = row.instituicaoSigla as string;

    let instituicaoId = instituicaoIdBySigla.get(sigla);
    if (instituicaoId === undefined) {
      const instituicao = await tx.instituicao.upsert({
        where: { sigla },
        create: {
          sigla,
          nome: row.instituicaoNome as string,
          organizacaoAcademica: row.organizacaoAcademica as string,
          regiao: row.regiao as string,
          uf: row.uf as string,
          estado: row.estado as string,
        },
        update: {
          nome: row.instituicaoNome as string,
          organizacaoAcademica: row.organizacaoAcademica as string,
          regiao: row.regiao as string,
          uf: row.uf as string,
          estado: row.estado as string,
        },
      });
      instituicaoId = instituicao.id;
      instituicaoIdBySigla.set(sigla, instituicaoId);
    }

    let unidadeId: number | undefined;
    const unidadeNome = row.unidadeNome as string | undefined;
    if (unidadeNome) {
      const cacheKey = `${instituicaoId}::${unidadeNome}`;
      unidadeId = unidadeIdByKey.get(cacheKey);
      if (unidadeId === undefined) {
        const unidade = await tx.unidade.upsert({
          where: { instituicaoId_nome: { instituicaoId, nome: unidadeNome } },
          create: { instituicaoId, nome: unidadeNome },
          update: {},
        });
        unidadeId = unidade.id;
        unidadeIdByKey.set(cacheKey, unidadeId);
      }
    }

    let dimensoesExtra: Prisma.InputJsonValue | undefined;
    if (extraDimensionFields.length > 0) {
      const valores: Record<string, unknown> = {};
      for (const [field] of extraDimensionFields) {
        valores[field] = row[field];
      }
      dimensoesExtra = valores as Prisma.InputJsonValue;
    }

    for (const [field, def] of measureFields) {
      const valor = row[field];
      if (valor === null || valor === undefined) {
        continue;
      }
      buffer.push({
        ingestionBatchId,
        fileType,
        ano: row.ano as number,
        instituicaoId,
        unidadeId: unidadeId ?? null,
        dimensoesExtra,
        medida: def.measureLabel as string,
        valor: valor as number,
      });
    }

    // Grava assim que o lote enche. O corte cai entre linhas do CSV (nunca no meio das medidas de
    // uma linha), então um lote pode passar um pouco de CHUNK_SIZE — irrelevante para o tamanho do
    // pacote e mantém cada linha do arquivo atômica dentro de um mesmo INSERT.
    if (buffer.length >= CHUNK_SIZE) {
      await gravarBuffer();
    }

    linhasProcessadas += 1;
    if (uploadId) {
      atualizarProgresso(uploadId, { processed: progressoOffset + linhasProcessadas });
      if (cancelamentoFoiSolicitado(uploadId)) {
        throw new IngestionCancelledError();
      }
    }
  }

  await gravarBuffer();

  return {
    insertedFactCount,
    instituicaoCount: instituicaoIdBySigla.size,
    unidadeCount: unidadeIdByKey.size,
  };
}
