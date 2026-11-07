/**
 * A "Proposta de distribuição orçamentária, versão 01" (PDF de 2027, recebido em 2026-11-07). Diferente das propostas de
 * transição (Sapucaia do Sul e Venâncio Aires), vale só para 2027 e tem quatro passos:
 *
 *   Matriz 1: a matriz dos câmpus com o EaD reclassificado pela Proen (as cerca de 8.000 matrículas MOOC de cada câmpus
 *             contam como MOOC, e não como EaD de fomento próprio, como na 5ª fase da MDO).
 *   Matriz 2: reparte o total recebido pelos câmpus em 2026 na proporção da Matriz 1.
 *   Matriz 3: 85% da Matriz 2. Os 15% restantes pagam a complementação.
 *   Complementação: acima de 2026, nada; queda de até R$ 1 milhão, completa até o valor de 2026; queda maior, completa até
 *             94% de 2026. Depois, nenhum câmpus fica abaixo do piso de R$ 950 mil.
 *
 * A complementação não é limitada pela reserva de 15%: no documento ela passa da reserva em R$ 3.439,41, e a tela mostra isso.
 */

export const PROPOSTA_V01 = {
  id: "versao-01",
  rotulo: "Proposta versão 01",
  documento: "Proposta de distribuição orçamentária, Câmpus, 2027 (versão 01)",
  fatorMatriz3: 0.85,
  limiteIntegral: 1_000_000,
  fracaoMinimaDe2026: 0.94,
  piso: 950_000,
} as const;

/** A Matriz 1 do documento (pág. 5), pelo nome do câmpus no cadastro. São Leopoldo fica fora: recebe o piso da MDO à parte. */
export const MATRIZ1_DO_DOCUMENTO: Readonly<Record<string, number>> = {
  "CAMPUS BAGÉ": 1_826_354.36,
  "CAMPUS CAMAQUÃ": 1_765_019.06,
  "CAMPUS CHARQUEADAS": 2_411_168.48,
  "CAMPUS GRAVATAÍ": 759_065.6,
  "CAMPUS JAGUARÃO": 607_654.33,
  "CAMPUS LAJEADO": 1_317_642.61,
  "CAMPUS NOVO HAMBURGO": 649_647.08,
  "CAMPUS PASSO FUNDO": 2_508_324.75,
  "CAMPUS PELOTAS": 9_324_909.44,
  "CAMPUS PELOTAS VISCONDE DA GRAÇA": 4_450_776.13,
  "CAMPUS SANTANA DO LIVRAMENTO": 2_592_865.45,
  "CAMPUS SAPIRANGA": 1_271_705.37,
  "CAMPUS SAPUCAIA DO SUL": 3_517_956.22,
  "CAMPUS VENÂNCIO AIRES": 1_434_987.44,
};

export type RegraAplicada = "acima-de-2026" | "integral" | "ate-94" | "piso";

export interface LinhaDaComplementacao {
  id: number;
  nome: string;
  base2026: number;
  matriz1: number;
  matriz2: number;
  matriz3: number;
  /** Matriz 3 menos 2026: negativo quando o câmpus cai. */
  diferenca: number;
  complemento: number;
  total: number;
  regra: RegraAplicada;
}

export interface ResultadoDaComplementacao {
  linhas: LinhaDaComplementacao[];
  somaBase: number;
  somaMatriz1: number;
  somaMatriz3: number;
  /** Os 15% que a Matriz 3 deixa de fora. */
  reserva: number;
  somaComplemento: number;
  somaTotal: number;
}

export function aplicarComplementacao(campi: readonly { id: number; nome: string; base2026: number; matriz1: number }[]): ResultadoDaComplementacao {
  const p = PROPOSTA_V01;
  const somaBase = campi.reduce((s, c) => s + c.base2026, 0);
  const somaMatriz1 = campi.reduce((s, c) => s + c.matriz1, 0);
  const linhas = campi.map((c): LinhaDaComplementacao => {
    const matriz2 = somaMatriz1 > 0 ? (c.matriz1 / somaMatriz1) * somaBase : 0;
    const matriz3 = p.fatorMatriz3 * matriz2;
    const diferenca = matriz3 - c.base2026;
    let total: number;
    let regra: RegraAplicada;
    if (diferenca >= 0) [total, regra] = [matriz3, "acima-de-2026"];
    else if (-diferenca <= p.limiteIntegral) [total, regra] = [c.base2026, "integral"];
    else [total, regra] = [Math.max(matriz3, p.fracaoMinimaDe2026 * c.base2026), "ate-94"];
    if (total < p.piso) [total, regra] = [p.piso, "piso"];
    return { ...c, matriz2, matriz3, diferenca, complemento: total - matriz3, total, regra };
  });
  const somaMatriz3 = linhas.reduce((s, l) => s + l.matriz3, 0);
  return {
    linhas,
    somaBase,
    somaMatriz1,
    somaMatriz3,
    reserva: somaBase - somaMatriz3,
    somaComplemento: linhas.reduce((s, l) => s + l.complemento, 0),
    somaTotal: linhas.reduce((s, l) => s + l.total, 0),
  };
}
