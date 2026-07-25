import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { PNP_FILE_TYPES, type PnpFileType } from "@/ingestion/config/fileTypes";

export interface UltimoUploadPorTipo {
  fileType: PnpFileType;
  originalFilename: string;
  rowCount: number | null;
  completedAt: string | null;
  createdAt: string;
}

/** Último batch com sucesso (`PERSISTED`) de cada tipo de arquivo PNP — usado na tela de upload. */
export async function GET() {
  const batches = await prisma.ingestionBatch.findMany({
    where: {
      status: { in: ["PERSISTED", "VALIDATED_WITH_WARNINGS"] },
      fileType: { in: PNP_FILE_TYPES as unknown as PnpFileType[] },
    },
    orderBy: { completedAt: "desc" },
    select: { fileType: true, originalFilename: true, rowCount: true, completedAt: true, createdAt: true },
  });

  const ultimoPorTipo = new Map<PnpFileType, (typeof batches)[number]>();
  for (const batch of batches) {
    if (!ultimoPorTipo.has(batch.fileType)) ultimoPorTipo.set(batch.fileType, batch);
  }

  const resultado: UltimoUploadPorTipo[] = Array.from(ultimoPorTipo.values()).map((batch) => ({
    fileType: batch.fileType,
    originalFilename: batch.originalFilename,
    rowCount: batch.rowCount,
    completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
    createdAt: batch.createdAt.toISOString(),
  }));

  return NextResponse.json(resultado);
}
