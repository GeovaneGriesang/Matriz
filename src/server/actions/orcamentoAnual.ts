"use server";

import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { ESTRATEGIA_FAIXAS_IEA_SELECIONAVEL } from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import { runCalculation } from "@/server/actions/runCalculation";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";
import { listarInstituicoesDoEscopo, type EscopoDistribuicao } from "@/server/queries/escopoInstituicoes";
import type { EstrategiaFaixasIea } from "@prisma/client";

/**
 * Valida a estratégia de faixas de IEA vinda do formulário.
 *
 * Antes esta função caía em `PLANILHA_2026` para qualquer valor que não fosse `FORPLAN_2025` —
 * então, ao ser criada a tabela do ciclo 2027, escolhê-la na tela gravava 2026 **em silêncio**: o
 * salvamento dizia "sucesso" e o ano ficava com a tabela errada. Um valor desconhecido agora é
 * recusado com mensagem, em vez de virar outro valor sem avisar.
 */
function parseEstrategiaFaixasIea(valor: FormDataEntryValue | null): EstrategiaFaixasIea | null {
  const texto = typeof valor === "string" ? valor : "";
  const conhecida = (Object.keys(ESTRATEGIA_FAIXAS_IEA_SELECIONAVEL) as EstrategiaFaixasIea[]).find(
    (chave) => chave === texto,
  );
  if (conhecida === undefined) return null;
  return ESTRATEGIA_FAIXAS_IEA_SELECIONAVEL[conhecida] ? conhecida : null;
}

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
  const ajusteBruto = formData.get("ajuste");
  const ajuste = ajusteBruto === null || ajusteBruto === "" ? 0 : Number(ajusteBruto);
  const valorAssistenciaEstudantil = Number(formData.get("valorAssistenciaEstudantil"));
  const percentualAnuidadeBruto = formData.get("percentualAnuidade");
  const percentualAnuidade =
    percentualAnuidadeBruto === null || percentualAnuidadeBruto === "" ? 0 : Number(percentualAnuidadeBruto);
  const pisoMinimoCampusNovoBruto = formData.get("pisoMinimoCampusNovo");
  const pisoMinimoCampusNovo =
    pisoMinimoCampusNovoBruto === null || pisoMinimoCampusNovoBruto === "" ? 0 : Number(pisoMinimoCampusNovoBruto);
  const estrategiaFaixasIea = parseEstrategiaFaixasIea(formData.get("estrategiaFaixasIea"));
  if (estrategiaFaixasIea === null) {
    return { ok: false, errorMessage: "Selecione uma tabela de faixas de IEA válida." };
  }

  if (!Number.isInteger(ano) || ano <= 0) {
    return { ok: false, errorMessage: "Ano inválido." };
  }
  if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
    return { ok: false, errorMessage: "O valor deve ser maior que R$ 0,00." };
  }
  if (!Number.isFinite(ajuste) || ajuste < 0) {
    return { ok: false, errorMessage: "O Ajuste não pode ser negativo." };
  }
  if (ajuste >= valorTotal) {
    return { ok: false, errorMessage: "O Ajuste não pode ser maior ou igual ao Custeio Bruto." };
  }
  if (!Number.isFinite(valorAssistenciaEstudantil) || valorAssistenciaEstudantil <= 0) {
    return { ok: false, errorMessage: "O valor deve ser maior que R$ 0,00." };
  }
  if (!Number.isFinite(percentualAnuidade) || percentualAnuidade < 0 || percentualAnuidade > 100) {
    return { ok: false, errorMessage: "O percentual de anuidade deve estar entre 0 e 100." };
  }
  if (!Number.isFinite(pisoMinimoCampusNovo) || pisoMinimoCampusNovo < 0) {
    return { ok: false, errorMessage: "O piso mínimo por câmpus novo não pode ser negativo." };
  }

  await prisma.orcamentoAnual.upsert({
    where: { ano },
    create: {
      ano,
      valorTotal,
      ajuste,
      valorAssistenciaEstudantil,
      percentualAnuidade,
      pisoMinimoCampusNovo,
      estrategiaFaixasIea,
    },
    update: {
      valorTotal,
      ajuste,
      valorAssistenciaEstudantil,
      percentualAnuidade,
      pisoMinimoCampusNovo,
      estrategiaFaixasIea,
    },
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
    ajuste: Number(orcamento.ajuste),
    orcamentoAssistenciaEstudantil: Number(orcamento.valorAssistenciaEstudantil),
    percentualAnuidade: Number(orcamento.percentualAnuidade),
    pisoMinimoCampusNovo: Number(orcamento.pisoMinimoCampusNovo),
    estrategiaFaixasIea: orcamento.estrategiaFaixasIea,
    origem: "OFICIAL",
    escopo,
  });

  return { ok: true, runId: resultado.runId, instituicoesIncluidas: instituicoes.length };
}

export interface ExcluirOrcamentoAnualResult {
  ok: boolean;
  errorMessage?: string;
  /** Cálculos oficiais daquele ano que continuam existindo — o usuário precisa saber disso. */
  calculosOficiaisRestantes?: number;
}

/**
 * Server Action (admin) que exclui a configuração de orçamento de um ano.
 *
 * Apaga SOMENTE a linha de `OrcamentoAnual` — os parâmetros que o administrador digitou (Custeio,
 * Ajuste, Assistência, Anuidade, Piso, faixas de IEA). Deliberadamente **não** apaga:
 *
 * - os cálculos já executados (`CalculationRun`/`CalculationResult`), que são registro histórico do
 *   que foi publicado e continuam alimentando a tela de Consulta;
 * - nenhum dado da PNP (`FatoIndicador`), que não pertence a um ano de orçamento e sim ao ano-base;
 * - os dados anuais oficiais (Matrícula Total equalizada, RAPP, Eficiência Acadêmica) nem a
 *   Composição de Repasse, que vivem em tabelas próprias e são reaproveitados por outros anos.
 *
 * Ou seja: excluir aqui significa "quero reconfigurar este ano do zero", não "quero apagar o
 * histórico deste ano". Se ainda houver cálculo oficial publicado, ele continua aparecendo em
 * Consulta — por isso o resultado devolve quantos sobraram, para a tela avisar.
 */
export async function excluirOrcamentoAnualAction(formData: FormData): Promise<ExcluirOrcamentoAnualResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const ano = Number(formData.get("ano"));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return { ok: false, errorMessage: "Ano inválido." };
  }

  const existente = await prisma.orcamentoAnual.findUnique({ where: { ano } });
  if (existente === null) {
    return { ok: false, errorMessage: `Não há orçamento cadastrado para ${ano}.` };
  }

  await prisma.orcamentoAnual.delete({ where: { ano } });

  // Runs oficiais são identificados pelo ano do orçamento guardado no snapshot de parâmetros.
  const calculosOficiaisRestantes = await prisma.calculationRun.count({
    where: {
      origem: "OFICIAL",
      status: "COMPLETED",
      parametersSnapshot: { path: "$.anoOrcamento", equals: ano },
    },
  });

  return { ok: true, calculosOficiaisRestantes };
}
