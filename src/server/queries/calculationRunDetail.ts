import { prisma } from "@/server/db/prisma";
import type { CalculationResult } from "@prisma/client";

export interface UnidadeResultado {
  id: number;
  nome: string;
  funcionamentoValorReais: number;
  assistenciaEstudantilValorReais: number;
  subtotalReais: number;
  /** "Memória de cálculo" do Bloco Funcionamento para este câmpus — formato definido em runCalculation.ts. */
  detalheFuncionamento: unknown;
  /** "Memória de cálculo" do Bloco de Assistência Estudantil (Ação 2994) para este câmpus. */
  detalheAssistenciaEstudantil: unknown;
}

export interface InstituicaoResultado {
  id: number;
  sigla: string;
  nome: string;
  reitoriaValorReais: number;
  /** IEA/RAP/IAPL só são apurados em nível de instituição na Matriz CONIF, não por câmpus. */
  qualidadeEficienciaValorReais: number;
  unidades: UnidadeResultado[];
  subtotalReais: number;
  /** "Memória de cálculo" do Bloco Reitorias para esta instituição. */
  detalheReitoria: unknown;
  /** "Memória de cálculo" do Bloco Qualidade e Eficiência (IEA/RAP/IAPL) para esta instituição. */
  detalheQualidadeEficiencia: unknown;
}

export interface CalculationRunDetail {
  run: {
    id: number;
    status: string;
    /** Ano de referência da PNP consultado (`FatoIndicador.ano`) — para runs oficiais, é `anoOrcamento - 2`. */
    ano: number | null;
    /** Ano do orçamento oficial (só preenchido para `origem: "OFICIAL"`); `null` em simulações. */
    anoOrcamento: number | null;
    orcamentoTotal: number | null;
    /** Orçamento da Ação 2994 (Assistência Estudantil / PNAES), `null` quando o run não informou nenhum. */
    orcamentoAssistenciaEstudantil: number | null;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  };
  instituicoes: InstituicaoResultado[];
  totalGeralReais: number;
}

const REGEX_AUTARQUIA = /^valorReais_autarquia_(\d+)$/;

/** Monta a árvore Instituição → Unidade a partir dos `CalculationResult` de um run, para exibição/consulta. */
async function montarInstituicoes(
  results: Pick<CalculationResult, "campusId" | "bloco" | "metrica" | "valor" | "detalhe">[],
): Promise<{ instituicoes: InstituicaoResultado[]; totalGeralReais: number }> {
  interface ValoresUnidade {
    funcionamento: number;
    assistenciaEstudantil: number;
    detalheFuncionamento: unknown;
    detalheAssistenciaEstudantil: unknown;
  }

  const unidadeValores = new Map<number, ValoresUnidade>();
  const reitoriaPorInstituicao = new Map<number, number>();
  const detalheReitoriaPorInstituicao = new Map<number, unknown>();
  const qualidadeEficienciaPorInstituicao = new Map<number, number>();
  const detalheQualidadeEficienciaPorInstituicao = new Map<number, unknown>();

  for (const resultado of results) {
    const valor = Number(resultado.valor);

    if (resultado.bloco === "REITORIAS" || resultado.bloco === "QUALIDADE_EFICIENCIA") {
      const match = resultado.metrica.match(REGEX_AUTARQUIA);
      if (!match) continue;
      const instituicaoId = Number(match[1]);
      if (resultado.bloco === "REITORIAS") {
        reitoriaPorInstituicao.set(instituicaoId, (reitoriaPorInstituicao.get(instituicaoId) ?? 0) + valor);
        detalheReitoriaPorInstituicao.set(instituicaoId, resultado.detalhe);
      } else {
        qualidadeEficienciaPorInstituicao.set(
          instituicaoId,
          (qualidadeEficienciaPorInstituicao.get(instituicaoId) ?? 0) + valor,
        );
        detalheQualidadeEficienciaPorInstituicao.set(instituicaoId, resultado.detalhe);
      }
      continue;
    }

    if (resultado.campusId === null) continue;
    const atual = unidadeValores.get(resultado.campusId) ?? {
      funcionamento: 0,
      assistenciaEstudantil: 0,
      detalheFuncionamento: null,
      detalheAssistenciaEstudantil: null,
    };
    if (resultado.bloco === "FUNCIONAMENTO") {
      atual.funcionamento += valor;
      atual.detalheFuncionamento = resultado.detalhe;
    }
    if (resultado.bloco === "ASSISTENCIA_ESTUDANTIL") {
      atual.assistenciaEstudantil += valor;
      atual.detalheAssistenciaEstudantil = resultado.detalhe;
    }
    unidadeValores.set(resultado.campusId, atual);
  }

  const unidades = await prisma.unidade.findMany({
    where: { id: { in: Array.from(unidadeValores.keys()) } },
    include: { instituicao: true },
  });

  const idsComSoInstituicao = new Set([
    ...reitoriaPorInstituicao.keys(),
    ...qualidadeEficienciaPorInstituicao.keys(),
  ]);
  const instituicoesComSoInstituicaoSemUnidade = Array.from(idsComSoInstituicao).filter(
    (id) => !unidades.some((u) => u.instituicaoId === id),
  );
  const instituicoesAvulsas = await prisma.instituicao.findMany({
    where: { id: { in: instituicoesComSoInstituicaoSemUnidade } },
  });

  const instituicoesPorId = new Map<number, InstituicaoResultado>();

  function obterOuCriarInstituicao(id: number, sigla: string, nome: string): InstituicaoResultado {
    const existente = instituicoesPorId.get(id);
    if (existente) return existente;
    const nova: InstituicaoResultado = {
      id,
      sigla,
      nome,
      reitoriaValorReais: reitoriaPorInstituicao.get(id) ?? 0,
      qualidadeEficienciaValorReais: qualidadeEficienciaPorInstituicao.get(id) ?? 0,
      unidades: [],
      subtotalReais: 0,
      detalheReitoria: detalheReitoriaPorInstituicao.get(id) ?? null,
      detalheQualidadeEficiencia: detalheQualidadeEficienciaPorInstituicao.get(id) ?? null,
    };
    instituicoesPorId.set(id, nova);
    return nova;
  }

  for (const unidade of unidades) {
    const valores = unidadeValores.get(unidade.id) ?? {
      funcionamento: 0,
      assistenciaEstudantil: 0,
      detalheFuncionamento: null,
      detalheAssistenciaEstudantil: null,
    };
    const instituicao = obterOuCriarInstituicao(
      unidade.instituicao.id,
      unidade.instituicao.sigla,
      unidade.instituicao.nome,
    );
    instituicao.unidades.push({
      id: unidade.id,
      nome: unidade.nome,
      funcionamentoValorReais: valores.funcionamento,
      assistenciaEstudantilValorReais: valores.assistenciaEstudantil,
      subtotalReais: valores.funcionamento + valores.assistenciaEstudantil,
      detalheFuncionamento: valores.detalheFuncionamento,
      detalheAssistenciaEstudantil: valores.detalheAssistenciaEstudantil,
    });
  }

  for (const instituicao of instituicoesAvulsas) {
    obterOuCriarInstituicao(instituicao.id, instituicao.sigla, instituicao.nome);
  }

  const instituicoes = Array.from(instituicoesPorId.values())
    .map((instituicao) => ({
      ...instituicao,
      subtotalReais:
        instituicao.reitoriaValorReais +
        instituicao.qualidadeEficienciaValorReais +
        instituicao.unidades.reduce((soma, u) => soma + u.subtotalReais, 0),
    }))
    .sort((a, b) => a.sigla.localeCompare(b.sigla));

  const totalGeralReais = instituicoes.reduce((soma, i) => soma + i.subtotalReais, 0);

  return { instituicoes, totalGeralReais };
}

/** Monta o detalhe de exibição de um único run (usado pelo Simulador e para recalcular uma instituição isolada). */
export async function getCalculationRunDetail(runId: number): Promise<CalculationRunDetail | null> {
  const run = await prisma.calculationRun.findUnique({
    where: { id: runId },
    include: { results: true },
  });
  if (!run) return null;

  const snapshot = run.parametersSnapshot as {
    ano?: number;
    anoOrcamento?: number;
    orcamentoTotal?: number;
    orcamentoAssistenciaEstudantil?: number;
  } | null;
  const { instituicoes, totalGeralReais } = await montarInstituicoes(run.results);

  return {
    run: {
      id: run.id,
      status: run.status,
      ano: snapshot?.ano ?? null,
      anoOrcamento: snapshot?.anoOrcamento ?? null,
      orcamentoTotal: snapshot?.orcamentoTotal ?? null,
      orcamentoAssistenciaEstudantil:
        snapshot?.orcamentoAssistenciaEstudantil !== undefined ? snapshot.orcamentoAssistenciaEstudantil : null,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      errorMessage: run.errorMessage,
    },
    instituicoes,
    totalGeralReais,
  };
}
