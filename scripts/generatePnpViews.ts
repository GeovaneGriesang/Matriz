import { MAPPING_BY_FILE_TYPE } from "../src/ingestion/config/fileMetadata";
import { PNP_FILE_TYPES, type PnpFileType } from "../src/ingestion/config/fileTypes";
import { CORE_DIMENSION_FIELDS } from "../src/ingestion/persistence/persistFatoIndicador";

/**
 * Gera, a partir do mesmo mapeamento de colunas usado na ingestão (`MAPPING_BY_FILE_TYPE`), uma
 * view MySQL "wide" por tipo de arquivo PNP — uma linha por entidade real (câmpus/curso/ano em vez
 * de uma linha por medida), com uma coluna por medida (`MAX(CASE WHEN medida = '...' THEN valor
 * END)`) e uma coluna por dimensão extra (extraída de `dimensoesExtra` via `->>`). Existe para
 * consulta/JOIN direto no MySQL (Workbench, `mysql` CLI etc.) — não é usada pelo Prisma/app.
 *
 * Reexecutar sempre que um `columnMappings/*.mapping.ts` mudar (coluna nova, medida renomeada) —
 * NUNCA editar a SQL gerada à mão nem duplicar esta lógica em outro lugar: rodar de novo com
 * `npx tsx scripts/generatePnpViews.ts > prisma/migrations/<novo_timestamp>_update_pnp_views/migration.sql`
 * (ver prisma/migrations/20260730120000_add_pnp_fato_views para o padrão de nome).
 */

function ident(name: string): string {
  return `\`${name}\``;
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function buildViewSql(fileType: PnpFileType): string {
  const mapping = MAPPING_BY_FILE_TYPE[fileType];
  const dimensionFields = Object.entries(mapping.columns).filter(([, def]) => def.kind === "dimension");
  const extraDimensionFields = dimensionFields
    .filter(([field]) => !CORE_DIMENSION_FIELDS.has(field))
    .map(([field]) => field);
  const measureFields = Object.entries(mapping.columns)
    .filter(([, def]) => def.kind === "measure")
    .map(([field, def]) => ({ field, measureLabel: def.measureLabel as string }));

  const viewName = `vw_${fileType.toLowerCase()}`;

  const extraDimSelectExprs = extraDimensionFields.map(
    (field) => `  f.dimensoesExtra ->> '$.${field}' AS ${ident(field)}`,
  );
  const extraDimGroupExprs = extraDimensionFields.map((field) => `  f.dimensoesExtra ->> '$.${field}'`);

  const measureSelectExprs = measureFields.map(
    ({ field, measureLabel }) =>
      `  MAX(CASE WHEN f.medida = '${escapeSqlString(measureLabel)}' THEN f.valor END) AS ${ident(field)}`,
  );

  const selectLines = [
    "  f.ano AS ano",
    "  i.sigla AS instituicaoSigla",
    "  i.nome AS instituicaoNome",
    "  f.instituicaoId AS instituicaoId",
    "  u.nome AS unidadeNome",
    "  f.unidadeId AS unidadeId",
    ...extraDimSelectExprs,
    ...measureSelectExprs,
  ];

  const groupByLines = [
    "  f.ano",
    "  f.instituicaoId",
    "  i.sigla",
    "  i.nome",
    "  f.unidadeId",
    "  u.nome",
    ...extraDimGroupExprs,
  ];

  return [
    `-- ${mapping.fileType}: ${measureFields.length} medida(s), ${extraDimensionFields.length} dimensão(ões) extra além de ano/instituição/câmpus.`,
    `CREATE OR REPLACE VIEW ${ident(viewName)} AS`,
    `SELECT`,
    selectLines.join(",\n"),
    `FROM FatoIndicador f`,
    `JOIN Instituicao i ON i.id = f.instituicaoId`,
    `LEFT JOIN Unidade u ON u.id = f.unidadeId`,
    `WHERE f.fileType = '${fileType}'`,
    `GROUP BY`,
    groupByLines.join(",\n"),
    `;`,
  ].join("\n");
}

const header = `-- Views geradas automaticamente por scripts/generatePnpViews.ts a partir de MAPPING_BY_FILE_TYPE.
-- Não editar à mão — reexecutar o script e criar uma nova migration se os mapeamentos mudarem.
-- Uma view por tipo de arquivo PNP, "wide" (uma coluna por medida) em vez do formato longo de
-- FatoIndicador, para permitir consulta e JOIN direto no MySQL (Workbench, mysql CLI etc.).
`;

console.log(header);
console.log(PNP_FILE_TYPES.map(buildViewSql).join("\n\n"));
