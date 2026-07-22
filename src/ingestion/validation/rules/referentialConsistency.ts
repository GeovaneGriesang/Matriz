import type { ValidationIssue } from "../ValidationReport";

/**
 * Verifica se os códigos de câmpus referenciados em um arquivo de fatos (ex.:
 * SituacaoMatricula, EficienciaAcademica) existem no conjunto de câmpus já
 * conhecido (normalmente populado a partir de um DadosGerais.csv ingerido
 * anteriormente). Assume-se que DadosGerais.csv é ingerido primeiro — ver
 * Pendências do plano de M1.
 */
export function validateReferentialConsistency<T extends { codigoCampus: string }>(
  rows: T[],
  codigosCampusConhecidos: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((row, rowIndex) => {
    if (!codigosCampusConhecidos.has(row.codigoCampus)) {
      issues.push({
        severity: "WARNING",
        code: "UNKNOWN_CAMPUS_REFERENCE",
        message: `Código de câmpus "${row.codigoCampus}" não encontrado nos dados de referência (DadosGerais).`,
        rowIndex,
        field: "codigoCampus",
      });
    }
  });

  return issues;
}
