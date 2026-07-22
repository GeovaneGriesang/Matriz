import type { ValidationIssue } from "../ValidationReport";

/**
 * Compara contagens agregadas por câmpus entre dois arquivos PNP distintos
 * (ex.: total de matrículas em SituacaoMatricula.csv vs. EficienciaAcademica.csv)
 * e sinaliza divergências acima da tolerância — não bloqueia a ingestão, apenas
 * alerta para possível inconsistência entre os extratos.
 */
export function validateCrossFileMatriculaCounts(
  contagensArquivoA: ReadonlyMap<string, number>,
  contagensArquivoB: ReadonlyMap<string, number>,
  rotuloArquivoA: string,
  rotuloArquivoB: string,
  tolerancia = 0.1,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const codigosCampus = new Set([...contagensArquivoA.keys(), ...contagensArquivoB.keys()]);

  for (const codigoCampus of codigosCampus) {
    const valorA = contagensArquivoA.get(codigoCampus) ?? 0;
    const valorB = contagensArquivoB.get(codigoCampus) ?? 0;
    const base = Math.max(valorA, valorB);
    const diferencaRelativa = base === 0 ? 0 : Math.abs(valorA - valorB) / base;

    if (diferencaRelativa > tolerancia) {
      issues.push({
        severity: "WARNING",
        code: "CROSS_FILE_COUNT_MISMATCH",
        message:
          `Câmpus "${codigoCampus}": contagem diverge entre ${rotuloArquivoA} (${valorA}) e ` +
          `${rotuloArquivoB} (${valorB}) além da tolerância de ${tolerancia * 100}%.`,
      });
    }
  }

  return issues;
}
