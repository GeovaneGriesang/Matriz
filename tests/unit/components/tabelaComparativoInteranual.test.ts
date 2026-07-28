import { describe, it, expect } from "vitest";
import { somarBlocosRede, mesclarInstituicoes, calcularSimulacaoReitoria } from "@/components/distribuicao/TabelaComparativoInteranual";
import type { CalculationRunDetail, InstituicaoResultado, UnidadeResultado } from "@/components/distribuicao/TabelaDistribuicao";

function unidade(overrides: {
  id: number;
  nome: string;
  funcionamentoValorReais: number;
  assistenciaEstudantilValorReais: number;
  matriculaPonderadaCampus: number;
}): UnidadeResultado {
  return {
    id: overrides.id,
    nome: overrides.nome,
    funcionamentoValorReais: overrides.funcionamentoValorReais,
    assistenciaEstudantilValorReais: overrides.assistenciaEstudantilValorReais,
    subtotalReais: overrides.funcionamentoValorReais + overrides.assistenciaEstudantilValorReais,
    detalheFuncionamento: {
      matriculaPonderadaCampus: overrides.matriculaPonderadaCampus,
      totalMatriculaPonderadaRede: overrides.matriculaPonderadaCampus,
      share: 1,
      pesoBloco: 0.8,
      valorBlocoRede: overrides.funcionamentoValorReais,
      pisoMinimoCampusNovo: 0,
      pisoAplicado: false,
      valorAntesDoPiso: overrides.funcionamentoValorReais,
      valorReais: overrides.funcionamentoValorReais,
    },
    detalheAssistenciaEstudantil: null,
  };
}

function instituicao(overrides: {
  id: number;
  sigla: string;
  reitoriaValorReais: number;
  qualidadeEficienciaValorReais: number;
  unidades: UnidadeResultado[];
}): InstituicaoResultado {
  const subtotalReais =
    overrides.reitoriaValorReais +
    overrides.qualidadeEficienciaValorReais +
    overrides.unidades.reduce((acc, u) => acc + u.subtotalReais, 0);
  return {
    id: overrides.id,
    sigla: overrides.sigla,
    nome: overrides.sigla,
    reitoriaValorReais: overrides.reitoriaValorReais,
    qualidadeEficienciaValorReais: overrides.qualidadeEficienciaValorReais,
    anuidadeConifValorReais: 0,
    unidades: overrides.unidades,
    subtotalReais,
    detalheReitoria: null,
    detalheQualidadeEficiencia: null,
    detalheAnuidadeConif: null,
    detalheCusteioOficial: null,
    detalheAssistenciaOficial: null,
  };
}

function runDetail(ano: number, instituicoes: InstituicaoResultado[]): CalculationRunDetail {
  return {
    run: {
      id: ano,
      status: "CONCLUIDO",
      ano,
      anoOrcamento: ano,
      orcamentoTotal: null,
      orcamentoAssistenciaEstudantil: null,
      percentualAnuidade: null,
      pisoMinimoCampusNovo: null,
      startedAt: `${ano}-01-01T00:00:00.000Z`,
      finishedAt: `${ano}-01-01T00:05:00.000Z`,
      errorMessage: null,
    },
    instituicoes,
    totalGeralReais: instituicoes.reduce((acc, i) => acc + i.subtotalReais, 0),
  };
}

// Instituição IFA existe nos dois anos; IFB só existe no Ano Atual ("novo").
const campusXAnterior = unidade({ id: 10, nome: "Câmpus X", funcionamentoValorReais: 50_000, assistenciaEstudantilValorReais: 8_000, matriculaPonderadaCampus: 100 });
const campusYAnterior = unidade({ id: 11, nome: "Câmpus Y", funcionamentoValorReais: 30_000, assistenciaEstudantilValorReais: 4_000, matriculaPonderadaCampus: 60 });
const ifaAnterior = instituicao({ id: 1, sigla: "IFA", reitoriaValorReais: 10_000, qualidadeEficienciaValorReais: 5_000, unidades: [campusXAnterior, campusYAnterior] });
const detalheAnterior = runDetail(2025, [ifaAnterior]);

const campusXAtual = unidade({ id: 10, nome: "Câmpus X", funcionamentoValorReais: 55_000, assistenciaEstudantilValorReais: 9_000, matriculaPonderadaCampus: 120 });
const campusYAtual = unidade({ id: 11, nome: "Câmpus Y", funcionamentoValorReais: 33_000, assistenciaEstudantilValorReais: 5_000, matriculaPonderadaCampus: 80 });
const ifaAtual = instituicao({ id: 1, sigla: "IFA", reitoriaValorReais: 16_000, qualidadeEficienciaValorReais: 6_000, unidades: [campusXAtual, campusYAtual] });
const campusZAtual = unidade({ id: 20, nome: "Câmpus Z", funcionamentoValorReais: 20_000, assistenciaEstudantilValorReais: 2_000, matriculaPonderadaCampus: 40 });
const ifbAtual = instituicao({ id: 2, sigla: "IFB", reitoriaValorReais: 8_000, qualidadeEficienciaValorReais: 3_000, unidades: [campusZAtual] });
const detalheAtual = runDetail(2026, [ifaAtual, ifbAtual]);

describe("somarBlocosRede — isolamento Funcionamento (20RL) x Assistência (2994)", () => {
  it("soma cada bloco isoladamente sem simulação de Reitoria", () => {
    const resumo = somarBlocosRede(detalheAtual);

    expect(resumo.funcionamento).toBe(55_000 + 33_000 + 20_000);
    expect(resumo.reitoria).toBe(16_000 + 8_000);
    expect(resumo.qualidadeEficiencia).toBe(6_000 + 3_000);
    expect(resumo.assistenciaEstudantil).toBe(9_000 + 5_000 + 2_000);
    expect(resumo.acao20RL).toBe(resumo.funcionamento + resumo.reitoria + resumo.qualidadeEficiencia);
    expect(resumo.total).toBe(resumo.acao20RL + resumo.assistenciaEstudantil);
    expect(resumo.total).toBe(157_000);
  });
});

describe("calcularSimulacaoReitoria", () => {
  it("congela a Reitoria só das instituições presentes nos dois anos (id estável)", () => {
    const simulacao = calcularSimulacaoReitoria(detalheAnterior, detalheAtual);

    expect(simulacao.has(2)).toBe(false); // IFB é nova no Ano Atual — nada para congelar
    const simIfa = simulacao.get(1);
    expect(simIfa).toBeDefined();
    expect(simIfa?.reitoriaSimulada).toBe(10_000); // reitoria de IFA no Ano Anterior
    expect(simIfa?.deltaReitoria).toBe(16_000 - 10_000);
    expect(simIfa?.pesoTotalMechda).toBe(120 + 80);
  });
});

describe("redistribuição da Reitoria simulada por MECHDA", () => {
  it("redistribui o excedente entre os câmpus da instituição proporcionalmente ao peso MECHDA do Ano Atual, mantendo o total da instituição inalterado", () => {
    const simulacao = calcularSimulacaoReitoria(detalheAnterior, detalheAtual);
    const resumoSimulado = somarBlocosRede(detalheAtual, simulacao);
    const resumoOficial = somarBlocosRede(detalheAtual);

    // Reitoria da rede cai pelo delta de IFA (IFB não tem par, não é afetada); Funcionamento sobe na mesma medida.
    expect(resumoSimulado.reitoria).toBe(resumoOficial.reitoria - 6_000);
    expect(resumoSimulado.funcionamento).toBe(resumoOficial.funcionamento + 6_000);
    // Dinheiro só migra de bolso — Ação 20RL e Total Geral não mudam.
    expect(resumoSimulado.acao20RL).toBe(resumoOficial.acao20RL);
    expect(resumoSimulado.total).toBe(resumoOficial.total);

    const instituicoes = mesclarInstituicoes(detalheAnterior.instituicoes, detalheAtual.instituicoes, simulacao);
    const ifa = instituicoes.find((i) => i.id === 1);
    expect(ifa?.reitoriaOficialAtual).toBe(16_000);
    expect(ifa?.reitoriaSimuladaAtual).toBe(10_000);
    // Total da instituição não muda com a simulação (money conservada dentro da instituição).
    expect(ifa?.totalAtual).toBe(ifaAtual.subtotalReais);

    const campusX = ifa?.campi.find((c) => c.id === 10);
    const campusY = ifa?.campi.find((c) => c.id === 11);
    // Peso MECHDA de X é 120/200 e de Y é 80/200 do delta de 6.000 devolvido pela Reitoria.
    expect(campusX?.funcionamentoAtual).toBe(55_000 + (120 / 200) * 6_000);
    expect(campusY?.funcionamentoAtual).toBe(33_000 + (80 / 200) * 6_000);

    // IFB (instituição nova, sem par no Ano Anterior) não é afetada pela simulação.
    const ifb = instituicoes.find((i) => i.id === 2);
    expect(ifb?.reitoriaSimuladaAtual).toBeNull();
    const campusZ = ifb?.campi.find((c) => c.id === 20);
    expect(campusZ?.funcionamentoAtual).toBe(20_000);
  });
});

describe("mesclarInstituicoes — colunas isoladas de Funcionamento (20RL) e Assistência (2994)", () => {
  it("separa os totais de Funcionamento e Assistência por instituição e por câmpus, mesmo sem simulação", () => {
    const instituicoes = mesclarInstituicoes(detalheAnterior.instituicoes, detalheAtual.instituicoes);
    const ifa = instituicoes.find((i) => i.id === 1);

    expect(ifa?.assistenciaAnterior).toBe(8_000 + 4_000);
    expect(ifa?.assistenciaAtual).toBe(9_000 + 5_000);
    expect(ifa?.funcionamentoAnterior).toBe(10_000 + 5_000 + 50_000 + 30_000);
    expect(ifa?.funcionamentoAtual).toBe(16_000 + 6_000 + 55_000 + 33_000);

    const campusX = ifa?.campi.find((c) => c.id === 10);
    expect(campusX?.funcionamentoAnterior).toBe(50_000);
    expect(campusX?.assistenciaAnterior).toBe(8_000);
    expect(campusX?.totalAnterior).toBe(58_000);
  });

  it("marca instituição só presente no Ano Atual com os campos do Ano Anterior nulos ('novo')", () => {
    const instituicoes = mesclarInstituicoes(detalheAnterior.instituicoes, detalheAtual.instituicoes);
    const ifb = instituicoes.find((i) => i.id === 2);

    expect(ifb?.funcionamentoAnterior).toBeNull();
    expect(ifb?.assistenciaAnterior).toBeNull();
    expect(ifb?.totalAnterior).toBeNull();
    expect(ifb?.totalAtual).toBe(33_000);
  });
});
