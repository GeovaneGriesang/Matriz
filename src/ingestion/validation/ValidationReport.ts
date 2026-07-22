export type Severity = "ERROR" | "WARNING";

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  rowIndex?: number;
  field?: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
}

export function hasErrors(report: ValidationReport): boolean {
  return report.issues.some((issue) => issue.severity === "ERROR");
}

export function mergeReports(...reports: ValidationReport[]): ValidationReport {
  return { issues: reports.flatMap((r) => r.issues) };
}
