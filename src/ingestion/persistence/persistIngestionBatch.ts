import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../server/db/prisma";
import type { PnpFileType } from "../config/fileTypes";
import { MAPPING_BY_FILE_TYPE } from "../config/fileMetadata";
import type { ValidationReport } from "../validation/ValidationReport";
import { hasErrors } from "../validation/ValidationReport";
import { persistFatoIndicador } from "./persistFatoIndicador";

export interface PersistIngestionBatchInput {
  fileType: PnpFileType;
  originalFilename: string;
  detectedEncoding: string;
  checksum: string;
  rowCount: number;
  validationReport: ValidationReport;
  uploadedByEmail?: string;
  /** Linhas já mapeadas e tipadas, específicas do fileType informado. */
  rows: Record<string, unknown>[];
}

export interface PersistIngestionBatchResult {
  ingestionBatchId: number;
  status: "PERSISTED" | "FAILED_VALIDATION" | "VALIDATED_WITH_WARNINGS";
}

/**
 * Persiste um batch de ingestão dentro de uma única transação: cria o registro
 * de auditoria (`IngestionBatch`) e, se a validação não tiver ERROS, grava os
 * fatos correspondentes via `persistFatoIndicador` — genérico para os 18
 * tipos de arquivo PNP, sem casos especiais por fileType. Qualquer falha
 * durante a gravação reverte a transação inteira.
 */
export async function persistIngestionBatch(
  input: PersistIngestionBatchInput,
  client: PrismaClient = prisma,
): Promise<PersistIngestionBatchResult> {
  const bloqueiaPersistencia = hasErrors(input.validationReport);
  const temAvisos = input.validationReport.issues.length > 0;

  return client.$transaction(async (tx) => {
    const batch = await tx.ingestionBatch.create({
      data: {
        status: bloqueiaPersistencia ? "FAILED_VALIDATION" : "VALIDATING",
        uploadedByEmail: input.uploadedByEmail,
        originalFilename: input.originalFilename,
        fileType: input.fileType,
        detectedEncoding: input.detectedEncoding,
        checksum: input.checksum,
        rowCount: input.rowCount,
        validationReport: input.validationReport as unknown as Prisma.InputJsonValue,
      },
    });

    if (bloqueiaPersistencia) {
      return { ingestionBatchId: batch.id, status: "FAILED_VALIDATION" };
    }

    const mapping = MAPPING_BY_FILE_TYPE[input.fileType];
    await persistFatoIndicador(tx, batch.id, input.fileType, mapping, input.rows);

    const status = temAvisos ? "VALIDATED_WITH_WARNINGS" : "PERSISTED";
    await tx.ingestionBatch.update({
      where: { id: batch.id },
      data: { status, completedAt: new Date() },
    });

    return { ingestionBatchId: batch.id, status };
  });
}
