import {
  faixaRap,
  pesoRap,
  pesoIaplTecnicos,
  pesoIaplFormacaoProfessores,
  pesoIaplProeja,
  type FaixaRap,
} from "@/lib/qualidadeEficiencia";

/**
 * O efeito, em reais por ano, de mudar um indicador do bloco Qualidade e Eficiência (RAP ou IAPL) de uma instituição:
 * ela é reencaixada numa faixa hipotética e a fatia dela na rede é recalculada. Funções puras, usadas pelo simulador de
 * indicadores (`SimuladorUnificado`) e pelo comparador de alternativas (`ComparadorAlternativas`).
 */

export interface RapInstituicao {
  rapPresencial: number;
  /** Soma do RAP ponderado recalculado de TODAS as outras instituições da rede (a desta fica de fora, porque é o que muda ao simular). */
  restoRedeRapPonderado: number;
}

export interface IaplInstituicao {
  aplTecnico: number;
  restoRedeTecnico: number;
  aplFormacaoProfessor: number;
  restoRedeFormacao: number;
  aplProeja: number;
  restoRedeProeja: number;
}

export interface ValoresIapl {
  tecnico: number;
  formacao: number;
  proeja: number;
}

/** Diferença em reais que simular uma nova RAP causaria no bloco RAP desta instituição. */
export function diferencaRap(rap: RapInstituicao, rapSimulada: number, totalBlocoRap: number): number {
  const pesoAtual = pesoRap(faixaRap(rap.rapPresencial));
  const ponderadoAtual = rap.rapPresencial * pesoAtual;
  const pesoSimulado = pesoRap(faixaRap(rapSimulada));
  const ponderadoSimulado = rapSimulada * pesoSimulado;
  const somaAtual = rap.restoRedeRapPonderado + ponderadoAtual;
  const somaSimulada = rap.restoRedeRapPonderado + ponderadoSimulado;
  const equalizadoAtual = somaAtual > 0 ? ponderadoAtual / somaAtual : 0;
  const equalizadoSimulado = somaSimulada > 0 ? ponderadoSimulado / somaSimulada : 0;
  return (equalizadoSimulado - equalizadoAtual) * totalBlocoRap;
}

/** Mesma ideia da RAP, mas com as três categorias do IAPL (0,7/0,2/0,1 de peso cada). */
export function diferencaIapl(iapl: IaplInstituicao, simulada: ValoresIapl, totalBlocoIapl: number): number {
  function fatia(atual: number, sim: number, resto: number, peso: (x: number) => number, participacao: number) {
    const ponderadoAtual = atual * peso(atual);
    const ponderadoSim = sim * peso(sim);
    const somaAtual = resto + ponderadoAtual;
    const somaSim = resto + ponderadoSim;
    const eqAtual = somaAtual > 0 ? (ponderadoAtual / somaAtual) * participacao : 0;
    const eqSim = somaSim > 0 ? (ponderadoSim / somaSim) * participacao : 0;
    return eqSim - eqAtual;
  }
  const tecnico = fatia(iapl.aplTecnico, simulada.tecnico, iapl.restoRedeTecnico, pesoIaplTecnicos, 0.7);
  const formacao = fatia(iapl.aplFormacaoProfessor, simulada.formacao, iapl.restoRedeFormacao, pesoIaplFormacaoProfessores, 0.2);
  const proeja = fatia(iapl.aplProeja, simulada.proeja, iapl.restoRedeProeja, pesoIaplProeja, 0.1);
  return (tecnico + formacao + proeja) * totalBlocoIapl;
}

/** Indicadores que o comparador deixa mexer. */
export type IndicadorSimulavel = "RAP" | "IAPL_TECNICO" | "IAPL_FORMACAO" | "IAPL_PROEJA";

export const ROTULO_INDICADOR: Record<IndicadorSimulavel, string> = {
  RAP: "RAP (alunos por professor)",
  IAPL_TECNICO: "IAPL, cursos técnicos (% das matrículas)",
  IAPL_FORMACAO: "IAPL, formação de professores (% das matrículas)",
  IAPL_PROEJA: "IAPL, Proeja (% das matrículas)",
};

/** Os degraus de cada indicador: a partir de que valor o peso sobe. É onde está o ganho: cruzar um degrau. */
export const DEGRAUS_INDICADOR: Record<IndicadorSimulavel, { valor: number; peso: number }[]> = {
  RAP: [
    { valor: 0, peso: 0 },
    { valor: 18, peso: 1 },
    { valor: 20, peso: 2 },
    { valor: 22, peso: 2.5 },
  ],
  IAPL_TECNICO: [
    { valor: 0, peso: 0 },
    { valor: 0.5, peso: 1 },
    { valor: 0.6, peso: 2 },
  ],
  IAPL_FORMACAO: [
    { valor: 0, peso: 0 },
    { valor: 0.1, peso: 1 },
    { valor: 0.15, peso: 2 },
    { valor: 0.2, peso: 2.5 },
  ],
  IAPL_PROEJA: [
    { valor: 0, peso: 0 },
    { valor: 0.025, peso: 1 },
    { valor: 0.05, peso: 2 },
    { valor: 0.1, peso: 2.5 },
  ],
};

/** O próximo degrau acima do valor atual, e quanto falta para chegar nele (null se já está no último). */
export function proximoDegrau(indicador: IndicadorSimulavel, valorAtual: number): { valor: number; peso: number; falta: number } | null {
  const degrau = DEGRAUS_INDICADOR[indicador].find((d) => d.valor > valorAtual + 1e-9);
  return degrau ? { ...degrau, falta: degrau.valor - valorAtual } : null;
}

export interface IndicadoresDaInstituicao {
  rap: RapInstituicao | null;
  iapl: IaplInstituicao | null;
  totalBlocoRap: number;
  totalBlocoIapl: number;
}

/** O valor atual do indicador escolhido, ou null se a instituição não o tem carregado no ciclo. */
export function valorAtualDoIndicador(indicador: IndicadorSimulavel, ind: IndicadoresDaInstituicao): number | null {
  if (indicador === "RAP") return ind.rap?.rapPresencial ?? null;
  if (!ind.iapl) return null;
  if (indicador === "IAPL_TECNICO") return ind.iapl.aplTecnico;
  if (indicador === "IAPL_FORMACAO") return ind.iapl.aplFormacaoProfessor;
  return ind.iapl.aplProeja;
}

/** Ganho anual, em reais, de levar um indicador do valor atual a `novoValor` (negativo se piora de faixa). */
export function ganhoDoIndicador(indicador: IndicadorSimulavel, novoValor: number, ind: IndicadoresDaInstituicao): number {
  if (indicador === "RAP") return ind.rap ? diferencaRap(ind.rap, novoValor, ind.totalBlocoRap) : 0;
  if (!ind.iapl) return 0;
  const simulada: ValoresIapl = { tecnico: ind.iapl.aplTecnico, formacao: ind.iapl.aplFormacaoProfessor, proeja: ind.iapl.aplProeja };
  if (indicador === "IAPL_TECNICO") simulada.tecnico = novoValor;
  else if (indicador === "IAPL_FORMACAO") simulada.formacao = novoValor;
  else simulada.proeja = novoValor;
  return diferencaIapl(ind.iapl, simulada, ind.totalBlocoIapl);
}

export type { FaixaRap };
