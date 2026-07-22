"use server";

import { ingestCsv } from "@/ingestion/pipeline";
import type { PnpFileType } from "@/ingestion/config/fileTypes";
import { PNP_FILE_TYPES } from "@/ingestion/config/fileTypes";

export interface UploadCsvActionResult {
  ok: boolean;
  ingestionBatchId?: number;
  status?: string;
  rowCount?: number;
  issueCount?: number;
  errorMessage?: string;
}

/** Server Action que recebe um upload de CSV da PNP e dispara o pipeline de ingestão. */
export async function uploadCsvAction(formData: FormData): Promise<UploadCsvActionResult> {
  const file = formData.get("file");
  const fileType = formData.get("fileType");

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
    });

    return {
      ok: resultado.status !== "FAILED_VALIDATION",
      ingestionBatchId: resultado.ingestionBatchId,
      status: resultado.status,
      rowCount: resultado.rowCount,
      issueCount: resultado.validationReport.issues.length,
    };
  } catch (error) {
    return { ok: false, errorMessage: (error as Error).message };
  }
}
