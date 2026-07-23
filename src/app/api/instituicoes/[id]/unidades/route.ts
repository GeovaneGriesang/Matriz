import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

/** Lista de câmpus (Unidade) de uma instituição — para o segundo select em cascata do simulador. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const instituicaoId = Number(idParam);
  if (Number.isNaN(instituicaoId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const unidades = await prisma.unidade.findMany({
    where: { instituicaoId },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(unidades);
}
