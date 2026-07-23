import { NextResponse } from "next/server";
import { getCalculationRunDetail } from "@/server/queries/calculationRunDetail";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const detalhe = await getCalculationRunDetail(id);
  if (!detalhe) {
    return NextResponse.json({ error: "Execução de cálculo não encontrada." }, { status: 404 });
  }

  return NextResponse.json(detalhe);
}
