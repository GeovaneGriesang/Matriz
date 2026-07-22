import type { ValidationIssue } from "../ValidationReport";

/**
 * Verificação defensiva pós-parsing: confirma que campos numéricos não são
 * negativos (Mateq, IEA, contagens de matrícula nunca deveriam ser negativos,
 * mesmo que a transformação de string->number tenha sucedido tecnicamente).
 */
export function validateNonNegativeNumbers<T extends Record<string, unknown>>(
  rows: T[],
  numericFields: (keyof T)[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((row, rowIndex) => {
    for (const field of numericFields) {
      const valor = row[field];
      if (typeof valor === "number" && (Number.isNaN(valor) || valor < 0)) {
        issues.push({
          severity: "ERROR",
          code: "INVALID_NUMERIC_VALUE",
          message: `Campo numérico "${String(field)}" tem valor inválido: ${valor}.`,
          rowIndex,
          field: String(field),
        });
      }
    }
  });

  return issues;
}
