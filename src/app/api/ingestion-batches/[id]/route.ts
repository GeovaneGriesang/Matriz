import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const batch = await prisma.ingestionBatch.findUnique({ where: { id } });
  if (!batch) {
    return NextResponse.json({ error: "Batch de ingestão não encontrado." }, { status: 404 });
  }

  return NextResponse.json(batch);
}
