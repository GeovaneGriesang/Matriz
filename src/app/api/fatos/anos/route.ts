import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { PNP_FILE_TYPES, type PnpFileType } from "@/ingestion/config/fileTypes";

/**
 * Anos com dado importado (`FatoIndicador.ano`), para popular o seletor de ano do simulador.
 * `fileType` opcional escopa para um tipo específico (usado pela tela de Dados importados) —
 * omitido mantém o comportamento antigo (anos de qualquer tipo).
 */
export async function GET(request: NextRequest) {
  const fileTypeParam = request.nextUrl.searchParams.get("fileType");
  const fileType =
    fileTypeParam && PNP_FILE_TYPES.includes(fileTypeParam as PnpFileType) ? (fileTypeParam as PnpFileType) : undefined;

  const linhas = await prisma.fatoIndicador.findMany({
    distinct: ["ano"],
    where: fileType ? { fileType } : undefined,
    select: { ano: true },
    orderBy: { ano: "desc" },
  });

  return NextResponse.json(linhas.map((linha) => linha.ano));
}
