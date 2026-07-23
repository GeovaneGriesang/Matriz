import { NextResponse } from "next/server";
import { runCalculation } from "@/server/actions/runCalculation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const orcamentoTotal = Number(body?.orcamentoTotal);
  const ano = Number(body?.ano);

  if (!Number.isFinite(orcamentoTotal) || orcamentoTotal <= 0) {
    return NextResponse.json({ error: "orcamentoTotal deve ser um número positivo." }, { status: 400 });
  }
  if (!Number.isInteger(ano) || ano <= 0) {
    return NextResponse.json({ error: "ano deve ser um ano de referência válido." }, { status: 400 });
  }

  const resultado = await runCalculation({ orcamentoTotal, ano });
  return NextResponse.json(resultado);
}
