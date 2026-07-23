import type { Prisma } from "@prisma/client";
import type { ColumnMapping } from "../config/mappingTypes";
import type { PnpFileType } from "../config/fileTypes";

const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Campos de dimensão que viram coluna própria (FK/escalar) em vez de entrar em `dimensoesExtra`. */
const CORE_DIMENSION_FIELDS = new Set([
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
): Promise<void> {
  const instituicaoIdBySigla = new Map<string, number>();
  const unidadeIdByKey = new Map<string, number>();

  const dimensionFields = Object.entries(mapping.columns).filter(([, def]) => def.kind === "dimension");
  const extraDimensionFields = dimensionFields.filter(([field]) => !CORE_DIMENSION_FIELDS.has(field));
  const measureFields = Object.entries(mapping.columns).filter(([, def]) => def.kind === "measure");

  const fatos: Prisma.FatoIndicadorCreateManyInput[] = [];

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
      fatos.push({
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
  }

  for (const parte of chunk(fatos, CHUNK_SIZE)) {
    await tx.fatoIndicador.createMany({ data: parte });
  }
}
