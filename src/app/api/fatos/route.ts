import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { PNP_FILE_TYPES, type PnpFileType } from "@/ingestion/config/fileTypes";
import { getMeasureLabels } from "@/ingestion/config/fileMetadata";

const PAGE_SIZE = 50;

export interface FatoImportadoLinha {
  ano: number;
  instituicaoId: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  unidadeId: number | null;
  unidadeNome: string | null;
  dimensoesExtra: Record<string, unknown> | null;
  /** Uma entrada por medida do tipo de arquivo (ver `colunas`), `null` quando essa medida não tem
   *  valor para esta linha (ex.: coluna opcional não preenchida no CSV original). */
  valores: (number | null)[];
}

export interface FatosImportadosResponse {
  total: number;
  page: number;
  pageSize: number;
  /** Medidas do tipo de arquivo, na mesma ordem de `linha.valores` — cada uma vira uma coluna na
   *  tela (pivotada a partir de `FatoIndicador.medida`, que antes era só mais uma linha). */
  colunas: string[];
  rows: FatoImportadoLinha[];
}

function parseIntParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

function buildOrderBySql(sortBy: string, sortDir: "asc" | "desc", measureLabels: string[]): Prisma.Sql {
  const dir = sortDir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  if (sortBy === "instituicao") return Prisma.sql`i.sigla ${dir}, f.ano DESC, u.nome ASC`;
  if (sortBy === "campus") return Prisma.sql`u.nome ${dir}, f.ano DESC, i.sigla ASC`;
  if (sortBy === "ano") return Prisma.sql`f.ano ${dir}, i.sigla ASC, u.nome ASC`;
  const indice = measureLabels.indexOf(sortBy);
  if (indice >= 0) {
    return Prisma.sql`${Prisma.raw(`col${indice}`)} ${dir}, f.ano DESC, i.sigla ASC`;
  }
  return Prisma.sql`f.ano DESC, i.sigla ASC, u.nome ASC`;
}

/**
 * Navegador genérico de `FatoIndicador` filtrado por tipo de arquivo PNP (obrigatório, é o que
 * define o significado de `medida`) e, opcionalmente, ano/instituição/câmpus/medida — usado pela
 * tela /dados-importados ("ver o que foi importado").
 *
 * Pivota `FatoIndicador` (uma linha por medida) numa linha por câmpus/dimensão com uma coluna por
 * medida — mais legível quando um tipo de arquivo tem várias medidas por câmpus (ex.: TaxaEvasao,
 * uma linha por curso/turno com "Número de Matrículas", "Número de Evadidos" e "Taxa de Evasão %").
 * Linhas que vieram da mesma linha do CSV original compartilham exatamente
 * (ano, instituicaoId, unidadeId, dimensoesExtra) — ver persistFatoIndicador.ts — então esse é o
 * agrupamento usado para reconstituir a linha original. `dimensoesExtra` (JSON) não pode ir direto
 * em GROUP BY no MySQL — agrupa pelo CAST para texto e seleciona o valor real via ANY_VALUE
 * (mesmo grupo, mesmo conteúdo, então qualquer um dos valores serve).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fileTypeParam = params.get("fileType");
  if (!fileTypeParam || !PNP_FILE_TYPES.includes(fileTypeParam as PnpFileType)) {
    return NextResponse.json(
      { errorMessage: "Parâmetro 'fileType' é obrigatório e deve ser um tipo de arquivo PNP válido." },
      { status: 400 },
    );
  }
  const fileType = fileTypeParam as PnpFileType;
  const ano = parseIntParam(params.get("ano"));
  const instituicaoId = parseIntParam(params.get("instituicaoId"));
  const unidadeId = parseIntParam(params.get("unidadeId"));
  const medida = params.get("medida") || undefined;
  const page = Math.max(1, parseIntParam(params.get("page")) ?? 1);
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";
  const sortBy = params.get("sortBy") || "ano";

  const measureLabels = getMeasureLabels(fileType);

  const condicoes: Prisma.Sql[] = [Prisma.sql`f.fileType = ${fileType}`];
  if (ano !== undefined) condicoes.push(Prisma.sql`f.ano = ${ano}`);
  if (instituicaoId !== undefined) condicoes.push(Prisma.sql`f.instituicaoId = ${instituicaoId}`);
  if (unidadeId !== undefined) condicoes.push(Prisma.sql`f.unidadeId = ${unidadeId}`);
  if (medida) condicoes.push(Prisma.sql`f.medida = ${medida}`);
  const whereSql = Prisma.join(condicoes, " AND ");

  const totalResult = await prisma.$queryRaw<{ total: bigint | number }[]>(Prisma.sql`
    SELECT COUNT(*) AS total FROM (
      SELECT 1 FROM FatoIndicador f
      WHERE ${whereSql}
      GROUP BY f.ano, f.instituicaoId, f.unidadeId, CAST(f.dimensoesExtra AS CHAR(4000))
    ) t
  `);
  const total = Number(totalResult[0]?.total ?? 0);

  const colunasSql =
    measureLabels.length > 0
      ? Prisma.join(
          measureLabels.map(
            (label, indice) => Prisma.sql`MAX(CASE WHEN f.medida = ${label} THEN f.valor END) AS ${Prisma.raw(`col${indice}`)}`,
          ),
          ", ",
        )
      : Prisma.empty;

  const orderBySql = buildOrderBySql(sortBy, sortDir, measureLabels);

  const linhasBrutas = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT
      f.ano AS ano,
      f.instituicaoId AS instituicaoId,
      i.sigla AS instituicaoSigla,
      i.nome AS instituicaoNome,
      f.unidadeId AS unidadeId,
      u.nome AS unidadeNome,
      ANY_VALUE(f.dimensoesExtra) AS dimensoesExtra
      ${measureLabels.length > 0 ? Prisma.sql`, ${colunasSql}` : Prisma.empty}
    FROM FatoIndicador f
    JOIN Instituicao i ON i.id = f.instituicaoId
    LEFT JOIN Unidade u ON u.id = f.unidadeId
    WHERE ${whereSql}
    GROUP BY f.ano, f.instituicaoId, i.sigla, i.nome, f.unidadeId, u.nome, CAST(f.dimensoesExtra AS CHAR(4000))
    ORDER BY ${orderBySql}
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `);

  const rows: FatoImportadoLinha[] = linhasBrutas.map((linha) => ({
    ano: linha.ano as number,
    instituicaoId: linha.instituicaoId as number,
    instituicaoSigla: linha.instituicaoSigla as string,
    instituicaoNome: linha.instituicaoNome as string,
    unidadeId: (linha.unidadeId as number | null) ?? null,
    unidadeNome: (linha.unidadeNome as string | null) ?? null,
    dimensoesExtra: (linha.dimensoesExtra as Record<string, unknown> | null) ?? null,
    valores: measureLabels.map((_, indice) => {
      const bruto = linha[`col${indice}`];
      return bruto === null || bruto === undefined ? null : Number(bruto);
    }),
  }));

  const resposta: FatosImportadosResponse = {
    total,
    page,
    pageSize: PAGE_SIZE,
    colunas: measureLabels,
    rows,
  };

  return NextResponse.json(resposta);
}
