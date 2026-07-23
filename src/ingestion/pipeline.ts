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
import { IngestionCancelledError } from "./errors";
import {
  iniciarProgresso,
  atualizarProgresso,
  finalizarProgresso,
  cancelamentoFoiSolicitado,
} from "../server/ingestionProgress";

export interface IngestCsvInput {
  fileType: PnpFileType;
  originalFilename: string;
  fileBuffer: Buffer;
  uploadedByEmail?: string;
  /** Identificador gerado no cliente para acompanhar progresso/cancelamento via `ingestionProgress`. */
  uploadId?: string;
}

export interface IngestCsvResult extends PersistIngestionBatchResult {
  validationReport: ValidationReport;
  rowCount: number;
}

/** Orquestra o pipeline completo: detectar encoding -> parsear -> mapear -> validar -> persistir. */
export async function ingestCsv(input: IngestCsvInput): Promise<IngestCsvResult> {
  const { uploadId } = input;
  if (uploadId) iniciarProgresso(uploadId);

  try {
    const checksum = createHash("sha256").update(input.fileBuffer).digest("hex");
    const encoding = detectEncoding(input.fileBuffer);
    const texto = decodeBuffer(input.fileBuffer, encoding);
    const csvRows = parseCsv(texto);

    const mapping = MAPPING_BY_FILE_TYPE[input.fileType];
    const { rows: linhasMapeadas, issues: issuesMapeamento } = mapRows(csvRows, mapping);

    // Exports da PNP incluem linhas de total nacional agregado (ex: "Ano ×
    // CarreiraSigla" somado em todas as instituições) sem nenhuma instituição
    // identificada. Nosso grão é sempre por instituição (FatoIndicador.instituicaoId
    // é obrigatório), então essas linhas não têm onde ser gravadas — são
    // ignoradas aqui, não tratadas como erro de validação.
    const rows = linhasMapeadas.filter((row) => {
      const sigla = row.instituicaoSigla;
      return !(typeof sigla === "string" && sigla.trim() === "");
    });
    const linhasSemInstituicao = linhasMapeadas.length - rows.length;
    const issuesTotalNacional: ValidationIssue[] =
      linhasSemInstituicao > 0
        ? [
            {
              severity: "WARNING",
              code: "SKIPPED_ROW_WITHOUT_INSTITUICAO",
              message: `${linhasSemInstituicao} linha(s) sem instituição identificada (linha de total agregado da PNP) foram ignoradas — não são gravadas no banco.`,
            },
          ]
        : [];

    if (uploadId) {
      atualizarProgresso(uploadId, { total: rows.length, status: "persisting" });
      if (cancelamentoFoiSolicitado(uploadId)) {
        throw new IngestionCancelledError();
      }
    }

    const requiredDimensionFields = Object.entries(mapping.columns)
      .filter(([, def]) => def.required && def.kind === "dimension" && !def.allowEmptyValue)
      .map(([field]) => field);
    const issuesCamposObrigatorios: ValidationIssue[] = validateRequiredFields(rows, requiredDimensionFields);

    const measureFields = Object.entries(mapping.columns)
      .filter(([, def]) => def.kind === "measure" && !def.allowNegativeValue)
      .map(([field]) => field);
    const issuesValoresNumericos: ValidationIssue[] = validateNonNegativeNumbers(rows, measureFields);

    const validationReport: ValidationReport = {
      issues: [...issuesMapeamento, ...issuesTotalNacional, ...issuesCamposObrigatorios, ...issuesValoresNumericos],
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
      uploadId,
    });

    if (uploadId) finalizarProgresso(uploadId, "done");
    return { ...persistResult, validationReport, rowCount: rows.length };
  } catch (error) {
    if (uploadId) {
      finalizarProgresso(
        uploadId,
        error instanceof IngestionCancelledError ? "cancelled" : "error",
        (error as Error).message,
      );
    }
    throw error;
  }
}
