import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";

export interface DistribuicaoOficialResumo {
  ano: number;
  valorTotal: number;
  /** Ano da PNP usado (ou a ser usado) como referência para este orçamento: `ano - 2`. */
  anoReferenciaPnp: number;
  runId: number | null;
  calculadoEm: string | null;
}

/** Para cada ano com orçamento configurado, a execução `origem: OFICIAL` mais recente (se já houver uma). */
export async function GET() {
  const orcamentos = await prisma.orcamentoAnual.findMany({ orderBy: { ano: "desc" } });

  const resumo: DistribuicaoOficialResumo[] = await Promise.all(
    orcamentos.map(async (orcamento) => {
      const run = await prisma.calculationRun.findFirst({
        where: {
          origem: "OFICIAL",
          status: "COMPLETED",
          parametersSnapshot: { path: "$.anoOrcamento", equals: orcamento.ano },
        },
        orderBy: { startedAt: "desc" },
      });

      return {
        ano: orcamento.ano,
        valorTotal: Number(orcamento.valorTotal),
        anoReferenciaPnp: orcamento.ano - DEFASAGEM_ANOS_REFERENCIA_PNP,
        runId: run?.id ?? null,
        calculadoEm: run ? run.startedAt.toISOString() : null,
      };
    }),
  );

  return NextResponse.json(resumo);
}
