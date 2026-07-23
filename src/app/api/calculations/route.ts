import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export interface CalculationRunSummary {
  id: number;
  status: string;
  origem: string;
  ano: number | null;
  orcamentoTotal: number | null;
  startedAt: string;
  finishedAt: string | null;
}

/** Lista as execuções de cálculo mais recentes, para a tela de "execuções anteriores" do simulador. */
export async function GET() {
  const runs = await prisma.calculationRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const resumo: CalculationRunSummary[] = runs.map((run) => {
    const snapshot = run.parametersSnapshot as { ano?: number; orcamentoTotal?: number } | null;
    return {
      id: run.id,
      status: run.status,
      origem: run.origem,
      ano: snapshot?.ano ?? null,
      orcamentoTotal: snapshot?.orcamentoTotal ?? null,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    };
  });

  return NextResponse.json(resumo);
}
