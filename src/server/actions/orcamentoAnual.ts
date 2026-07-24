"use server";

import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { runCalculation } from "@/server/actions/runCalculation";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";
import { listarInstituicoesDoEscopo, type EscopoDistribuicao } from "@/server/queries/escopoInstituicoes";

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
  errorMessage?: string;
  runId?: number;
  instituicoesIncluidas?: number;
}

/**
 * Server Action (admin) que trava a distribuição oficial de um ano: divide o orçamento configurado
 * entre todas as instituições do escopo escolhido (CONIF ou Todas) e seus câmpus, pela metodologia
 * dos blocos — não copia o valor inteiro para cada instituição (ver `runCalculation`/`blocoReitorias`).
 */
export async function calcularDistribuicaoOficialAction(formData: FormData): Promise<CalcularDistribuicaoOficialResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const ano = Number(formData.get("ano"));
  const escopo: EscopoDistribuicao = formData.get("escopo") === "TODAS" ? "TODAS" : "CONIF";
  if (!Number.isInteger(ano) || ano <= 0) {
    return { ok: false, errorMessage: "Ano inválido." };
  }

  const orcamento = await prisma.orcamentoAnual.findUnique({ where: { ano } });
  if (!orcamento) {
    return { ok: false, errorMessage: `Nenhum orçamento configurado para ${ano}.` };
  }

  const anoReferenciaPnp = ano - DEFASAGEM_ANOS_REFERENCIA_PNP;
  const instituicoes = await listarInstituicoesDoEscopo(escopo, anoReferenciaPnp);
  if (instituicoes.length === 0) {
    return {
      ok: false,
      errorMessage: `Nenhuma instituição do escopo "${escopo}" tem dados da PNP de ${anoReferenciaPnp} importados ainda.`,
    };
  }

  const resultado = await runCalculation({
    instituicaoIds: instituicoes.map((i) => i.id),
    ano: anoReferenciaPnp,
    anoOrcamento: ano,
    orcamentoTotal: Number(orcamento.valorTotal),
    origem: "OFICIAL",
    escopo,
  });

  return { ok: true, runId: resultado.runId, instituicoesIncluidas: instituicoes.length };
}
