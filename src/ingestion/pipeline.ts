import { createHash } from "node:crypto";
import { detectEncoding, decodeBuffer } from "./encoding/detectEncoding";
import { parseCsv } from "./parsing/csvParser";
import { mapRows } from "./parsing/mapRows";
import type { PnpFileType } from "./config/fileTypes";
import { MAPPING_BY_FILE_TYPE } from "./config/fileMetadata";
import { validateRequiredFields } from "./validation/rules/requiredFields";
import { validateNonNegativeNumbers } from "./validation/rules/typeCoercion";
import type { ValidationIssue, ValidationReport } from "./validation/ValidationReport";
import { persistIngestionBatch } from "./persistence/persistIngestionBatch";
import type { PersistIngestionBatchResult } from "./persistence/persistIngestionBatch";

export interface IngestCsvInput {
  fileType: PnpFileType;
  originalFilename: string;
  fileBuffer: Buffer;
  uploadedByEmail?: string;
}

export interface IngestCsvResult extends PersistIngestionBatchResult {
  validationReport: ValidationReport;
  rowCount: number;
}

/** Orquestra o pipeline completo: detectar encoding -> parsear -> mapear -> validar -> persistir. */
export async function ingestCsv(input: IngestCsvInput): Promise<IngestCsvResult> {
  const checksum = createHash("sha256").update(input.fileBuffer).digest("hex");
  const encoding = detectEncoding(input.fileBuffer);
  const texto = decodeBuffer(input.fileBuffer, encoding);
  const csvRows = parseCsv(texto);

  const mapping = MAPPING_BY_FILE_TYPE[input.fileType];
  const { rows, issues: issuesMapeamento } = mapRows(csvRows, mapping);

  const requiredDimensionFields = Object.entries(mapping.columns)
    .filter(([, def]) => def.required && def.kind === "dimension")
    .map(([field]) => field);
  const issuesCamposObrigatorios: ValidationIssue[] = validateRequiredFields(rows, requiredDimensionFields);

  const measureFields = Object.entries(mapping.columns)
    .filter(([, def]) => def.kind === "measure")
    .map(([field]) => field);
  const issuesValoresNumericos: ValidationIssue[] = validateNonNegativeNumbers(rows, measureFields);

  const validationReport: ValidationReport = {
    issues: [...issuesMapeamento, ...issuesCamposObrigatorios, ...issuesValoresNumericos],
  };

  const persistResult = await persistIngestionBatch({
    fileType: input.fileType,
    originalFilename: input.originalFilename,
    detectedEncoding: encoding,
    checksum,
    rowCount: rows.length,
    validationReport,
    uploadedByEmail: input.uploadedByEmail,
    rows,
  });

  return { ...persistResult, validationReport, rowCount: rows.length };
}
