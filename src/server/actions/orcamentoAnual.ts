"use server";

import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { runCalculation } from "@/server/actions/runCalculation";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";

export interface SalvarOrcamentoAnualResult {
  ok: boolean;
  errorMessage?: string;
}

/** Server Action (admin) que grava/atualiza o orçamento total oficial de um ano. */
export async function salvarOrcamentoAnualAction(formData: FormData): Promise<SalvarOrcamentoAnualResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const ano = Number(formData.get("ano"));
  const valorTotal = Number(formData.get("valorTotal"));

  if (!Number.isInteger(ano) || ano <= 0) {
    return { ok: false, errorMessage: "Ano inválido." };
  }
  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    return { ok: false, errorMessage: "Valor do orçamento deve ser um número positivo." };
  }

  await prisma.orcamentoAnual.upsert({
    where: { ano },
    create: { ano, valorTotal },
    update: { valorTotal },
  });

  return { ok: true };
}

export interface CalcularDistribuicaoOficialResult {
  ok: boolean;
  runId?: number;
  errorMessage?: string;
}

/** Server Action (admin) que trava a distribuição oficial de um ano, usando o orçamento configurado para ele. */
export async function calcularDistribuicaoOficialAction(formData: FormData): Promise<CalcularDistribuicaoOficialResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano) || ano <= 0) {
    return { ok: false, errorMessage: "Ano inválido." };
  }

  const orcamento = await prisma.orcamentoAnual.findUnique({ where: { ano } });
  if (!orcamento) {
    return { ok: false, errorMessage: `Nenhum orçamento configurado para o ano ${ano}.` };
  }

  const anoReferenciaPnp = ano - DEFASAGEM_ANOS_REFERENCIA_PNP;
  const temDadosReferencia = await prisma.fatoIndicador.findFirst({ where: { ano: anoReferenciaPnp } });
  if (!temDadosReferencia) {
    return {
      ok: false,
      errorMessage: `O orçamento de ${ano} é calculado com dados da PNP de ${anoReferenciaPnp}, mas nenhum dado desse ano foi importado ainda.`,
    };
  }

  const resultado = await runCalculation({
    ano: anoReferenciaPnp,
    anoOrcamento: ano,
    orcamentoTotal: Number(orcamento.valorTotal),
    origem: "OFICIAL",
  });

  return { ok: true, runId: resultado.runId };
}
