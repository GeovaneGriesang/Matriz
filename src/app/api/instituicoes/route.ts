import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

/** Lista de instituições para os seletores de "ajuste por câmpus" do simulador. */
export async function GET() {
  const instituicoes = await prisma.instituicao.findMany({
    select: { id: true, sigla: true, nome: true },
    orderBy: { sigla: "asc" },
  });

  return NextResponse.json(instituicoes);
}
