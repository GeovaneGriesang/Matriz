import type { ColumnMapping } from "../config/mappingTypes";
import type { ValidationIssue } from "../validation/ValidationReport";

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function resolveHeaderIndex(headers: string[], candidates: string[]): number | undefined {
  const normalizedHeaders = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(normalizeHeader(candidate));
    if (idx !== -1) {
      return idx;
    }
  }
  return undefined;
}

export interface MapRowsResult<T> {
  rows: T[];
  issues: ValidationIssue[];
}

/**
 * Resolve o header de cada coluna canônica (tolerando variações via
 * `sourceHeaderCandidates`) e mapeia as linhas de dados para objetos tipados.
 * Colunas obrigatórias ausentes interrompem o mapeamento (ERROR); colunas
 * opcionais ausentes geram apenas um aviso (WARNING) e o campo é tratado como
 * string vazia antes da transformação.
 */
export function mapRows<T extends Record<string, unknown>>(
  csvRows: string[][],
  mapping: ColumnMapping<T>,
): MapRowsResult<T> {
  const issues: ValidationIssue[] = [];

  if (csvRows.length === 0) {
    issues.push({ severity: "ERROR", code: "EMPTY_FILE", message: "Arquivo CSV vazio (sem header)." });
    return { rows: [], issues };
  }

  const [headerRow, ...dataRows] = csvRows;
  const headers = headerRow ?? [];
  const fieldNames = Object.keys(mapping.columns) as (keyof T)[];

  const indexByField = new Map<keyof T, number | undefined>();
  for (const field of fieldNames) {
    const columnDef = mapping.columns[field];
    const idx = resolveHeaderIndex(headers, columnDef.sourceHeaderCandidates);
    indexByField.set(field, idx);

    if (idx === undefined) {
      issues.push({
        severity: columnDef.required ? "ERROR" : "WARNING",
        code: columnDef.required ? "MISSING_REQUIRED_COLUMN" : "MISSING_OPTIONAL_COLUMN",
        message: `Coluna "${String(field)}" não encontrada (candidatos: ${columnDef.sourceHeaderCandidates.join(", ")}).`,
        field: String(field),
      });
    }
  }

  const temColunaObrigatoriaFaltando = fieldNames.some(
    (field) => mapping.columns[field].required && indexByField.get(field) === undefined,
  );
  if (temColunaObrigatoriaFaltando) {
    return { rows: [], issues };
  }

  const rows: T[] = [];
  dataRows.forEach((rawRow, rowIndex) => {
    const mapped: Partial<T> = {};
    let rowFalhou = false;

    for (const field of fieldNames) {
      const columnDef = mapping.columns[field];
      const idx = indexByField.get(field);
      const rawValue = idx === undefined ? "" : (rawRow[idx] ?? "");
      try {
        mapped[field] = columnDef.transform(rawValue);
      } catch (error) {
        rowFalhou = true;
        issues.push({
          severity: "ERROR",
          code: "TYPE_COERCION_FAILED",
          message: `Falha ao converter a coluna "${String(field)}": ${(error as Error).message}`,
          rowIndex,
          field: String(field),
        });
      }
    }

    if (!rowFalhou) {
      rows.push(mapped as T);
    }
  });

  return { rows, issues };
}
