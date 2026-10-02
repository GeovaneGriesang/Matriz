/**
 * As variações do comparativo entre dois ciclos (A e B, por exemplo 2026 e 2027) de um câmpus, que tem dois valores por ciclo:
 * o CALCULADO (o que a matriz da MDO diz que ele recebe) e o INFORMADO (o que ele de fato recebeu, digitado em "Valores
 * recebidos"). Cinco comparações, todas lidas do primeiro valor para o segundo. Funções puras.
 */

export interface ValoresDoCampus {
  calculadoA: number;
  informadoA: number | null;
  calculadoB: number;
  informadoB: number | null;
}

export type ChaveVariacao = "calcA_infA" | "calcA_calcB" | "infA_calcB" | "infA_infB" | "calcB_infB";

export interface DefinicaoVariacao {
  chave: ChaveVariacao;
  /** O ponto de partida e o de chegada, para o título da coluna. */
  de: { tipo: "calculado" | "informado"; ciclo: "A" | "B" };
  para: { tipo: "calculado" | "informado"; ciclo: "A" | "B" };
}

export const VARIACOES: DefinicaoVariacao[] = [
  { chave: "calcA_infA", de: { tipo: "calculado", ciclo: "A" }, para: { tipo: "informado", ciclo: "A" } },
  { chave: "calcA_calcB", de: { tipo: "calculado", ciclo: "A" }, para: { tipo: "calculado", ciclo: "B" } },
  { chave: "infA_calcB", de: { tipo: "informado", ciclo: "A" }, para: { tipo: "calculado", ciclo: "B" } },
  { chave: "infA_infB", de: { tipo: "informado", ciclo: "A" }, para: { tipo: "informado", ciclo: "B" } },
  { chave: "calcB_infB", de: { tipo: "calculado", ciclo: "B" }, para: { tipo: "informado", ciclo: "B" } },
];

export interface Variacao {
  /** Valor de chegada menos valor de partida. */
  absoluta: number;
  /** Chegada sobre partida, menos 1 (0,05 = +5%); null quando a partida é zero. */
  percentual: number | null;
}

export function valorDe(v: ValoresDoCampus, ponto: { tipo: "calculado" | "informado"; ciclo: "A" | "B" }): number | null {
  if (ponto.tipo === "calculado") return ponto.ciclo === "A" ? v.calculadoA : v.calculadoB;
  return ponto.ciclo === "A" ? v.informadoA : v.informadoB;
}

/** A variação do primeiro valor para o segundo; null quando falta um dos dois (por exemplo, o informado não foi cadastrado). */
export function variacaoEntre(de: number | null, para: number | null): Variacao | null {
  if (de === null || para === null) return null;
  return { absoluta: para - de, percentual: de !== 0 ? para / de - 1 : null };
}

export function variacaoDoCampus(def: DefinicaoVariacao, v: ValoresDoCampus): Variacao | null {
  return variacaoEntre(valorDe(v, def.de), valorDe(v, def.para));
}

export interface TotalDaVariacao {
  de: number;
  para: number;
  variacao: Variacao;
  /** Em quantos câmpus a comparação foi possível (os dois valores existem), e quantos câmpus há. */
  comparados: number;
  total: number;
}

/**
 * O total de uma variação sobre vários câmpus. Só entram os câmpus que têm os DOIS valores: somar o calculado de todos contra o
 * informado de alguns daria uma diferença que é só falta de cadastro.
 */
export function totalDaVariacao(def: DefinicaoVariacao, campi: ValoresDoCampus[]): TotalDaVariacao | null {
  let de = 0;
  let para = 0;
  let comparados = 0;
  for (const c of campi) {
    const d = valorDe(c, def.de);
    const p = valorDe(c, def.para);
    if (d === null || p === null) continue;
    de += d;
    para += p;
    comparados++;
  }
  const variacao = comparados > 0 ? variacaoEntre(de, para) : null;
  return variacao ? { de, para, variacao, comparados, total: campi.length } : null;
}
