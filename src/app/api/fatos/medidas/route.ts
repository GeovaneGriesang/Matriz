import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { PNP_FILE_TYPES, type PnpFileType } from "@/ingestion/config/fileTypes";

/** Medidas (`FatoIndicador.medida`) disponíveis para um tipo de arquivo PNP — popula o seletor de
 *  medida da tela de Dados importados, sem precisar manter essa lista duplicada no front-end. */
export async function GET(request: NextRequest) {
  const fileTypeParam = request.nextUrl.searchParams.get("fileType");
  if (!fileTypeParam || !PNP_FILE_TYPES.includes(fileTypeParam as PnpFileType)) {
    return NextResponse.json(
      { errorMessage: "Parâmetro 'fileType' é obrigatório e deve ser um tipo de arquivo PNP válido." },
      { status: 400 },
    );
  }

  const linhas = await prisma.fatoIndicador.findMany({
    where: { fileType: fileTypeParam as PnpFileType },
    distinct: ["medida"],
    select: { medida: true },
    orderBy: { medida: "asc" },
  });

  return NextResponse.json(linhas.map((linha) => linha.medida));
}
