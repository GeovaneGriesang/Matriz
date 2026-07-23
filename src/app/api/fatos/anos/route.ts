import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

/** Anos com dado importado (`FatoIndicador.ano`), para popular o seletor de ano do simulador. */
export async function GET() {
  const linhas = await prisma.fatoIndicador.findMany({
    distinct: ["ano"],
    select: { ano: true },
    orderBy: { ano: "desc" },
  });

  return NextResponse.json(linhas.map((linha) => linha.ano));
}
