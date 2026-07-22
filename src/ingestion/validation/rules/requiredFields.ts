import type { ValidationIssue } from "../ValidationReport";

/**
 * Verifica se campos obrigatórios do tipo string não ficaram vazios após a
 * transformação (complementar à checagem de coluna ausente feita em mapRows).
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  rows: T[],
  requiredStringFields: (keyof T)[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((row, rowIndex) => {
    for (const field of requiredStringFields) {
      const valor = row[field];
      if (typeof valor === "string" && valor.trim() === "") {
        issues.push({
          severity: "ERROR",
          code: "REQUIRED_FIELD_EMPTY",
          message: `Campo obrigatório "${String(field)}" está vazio.`,
          rowIndex,
          field: String(field),
        });
      }
    }
  });

  return issues;
}
