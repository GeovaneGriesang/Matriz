"use server";

import { ingestCsv } from "@/ingestion/pipeline";
import { IngestionCancelledError } from "@/ingestion/errors";
import type { PnpFileType } from "@/ingestion/config/fileTypes";
import { PNP_FILE_TYPES } from "@/ingestion/config/fileTypes";

export interface UploadCsvActionResult {
  ok: boolean;
  cancelled?: boolean;
  ingestionBatchId?: number;
  status?: string;
  rowCount?: number;
  issueCount?: number;
  errorMessage?: string;
  /** Presente quando a validação falhou — mensagens concretas (coluna/linha) para o usuário corrigir o CSV. */
  issues?: { severity: string; message: string; field?: string; rowIndex?: number }[];
  tabelasAfetadas?: {
    deletedFactCount: number;
    insertedFactCount: number;
    instituicaoCount: number;
    unidadeCount: number;
  };
}

/** Server Action que recebe um upload de CSV da PNP e dispara o pipeline de ingestão. */
export async function uploadCsvAction(formData: FormData): Promise<UploadCsvActionResult> {
  const file = formData.get("file");
  const fileType = formData.get("fileType");
  const uploadId = formData.get("uploadId");

  if (!(file instanceof File)) {
    return { ok: false, errorMessage: "Nenhum arquivo enviado." };
  }
  if (typeof fileType !== "string" || !PNP_FILE_TYPES.includes(fileType as PnpFileType)) {
    return { ok: false, errorMessage: `Tipo de arquivo PNP inválido: "${fileType}".` };
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const resultado = await ingestCsv({
      fileType: fileType as PnpFileType,
      originalFilename: file.name,
      fileBuffer,
      uploadId: typeof uploadId === "string" ? uploadId : undefined,
    });

    const falhouValidacao = resultado.status === "FAILED_VALIDATION";

    return {
      ok: !falhouValidacao,
      ingestionBatchId: resultado.ingestionBatchId,
      status: resultado.status,
      rowCount: resultado.rowCount,
      issueCount: resultado.validationReport.issues.length,
      errorMessage: falhouValidacao
        ? `Falha na validação do arquivo: ${resultado.validationReport.issues.length} problema(s) encontrado(s).`
        : undefined,
      issues: falhouValidacao
        ? resultado.validationReport.issues
            .filter((issue) => issue.severity === "ERROR")
            .slice(0, 20)
            .map((issue) => ({
              severity: issue.severity,
              message: issue.message,
              field: issue.field,
              rowIndex: issue.rowIndex,
            }))
        : undefined,
      tabelasAfetadas: resultado.tabelasAfetadas,
    };
  } catch (error) {
    if (error instanceof IngestionCancelledError) {
      return { ok: false, cancelled: true, errorMessage: error.message };
    }
    return { ok: false, errorMessage: (error as Error).message };
  }
}
