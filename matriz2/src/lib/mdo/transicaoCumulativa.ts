/**
 * Transição cumulativa da proposta levada ao Colégio de Dirigentes do IFSul ("Proposta de adoção da Matriz Orçamentária
 * SETEC-CONIF para distribuição de orçamento entre Câmpus do IFSul", Fabio Lemes, Câmpus Sapucaia do Sul):
 *
 *   2027: V27 = V26 + 0,33 × (M27 − V26)
 *   2028: V28 = V27 + 0,66 × (M28 − V27)
 *   2029: V29 = M29
 *
 * V é o valor distribuído ao câmpus e M, a referência da Matriz SETEC-CONIF no mesmo ano. Os percentuais incidem sobre a
 * diferença que ainda resta até a matriz daquele ano, e não sobre a diferença de 2026: por isso se diz "cumulativa".
 *
 * Esta regra NÃO conserva o total: cada câmpus anda em direção à própria matriz, sem repartir um orçamento fixo. A soma dos
 * câmpus só coincide com a soma da matriz no último ano. A tela mostra essa diferença em vez de escondê-la.
 */

export interface EtapaTransicao {
  ano: number;
  /** Fração da diferença até a matriz do ano que é incorporada (0 a 1). */
  fracao: number;
}

export const ETAPAS_DA_PROPOSTA: readonly EtapaTransicao[] = [
  { ano: 2027, fracao: 0.33 },
  { ano: 2028, fracao: 0.66 },
  { ano: 2029, fracao: 1 },
];

export interface AnoDaTransicao {
  ano: number;
  fracao: number;
  /** Valor de que o ano parte: o do ano anterior. */
  base: number;
  matriz: number;
  /** Diferença até a matriz do ano (matriz − base). */
  diferenca: number;
  /** Quanto o ano incorpora da diferença (fração × diferença); negativo quando o câmpus reduz. */
  acrescimo: number;
  valor: number;
  /** Variação sobre o ano anterior (0,057 = +5,7%); nula se o câmpus partia de zero. */
  variacao: number | null;
}

/** A trajetória de um câmpus. `matrizes` traz a referência de cada etapa, na mesma ordem. */
export function transicaoDoCampus(baseInicial: number, matrizes: readonly number[], etapas: readonly EtapaTransicao[] = ETAPAS_DA_PROPOSTA): AnoDaTransicao[] {
  let base = baseInicial;
  return etapas.map((etapa, i) => {
    const matriz = matrizes[i] ?? 0;
    const diferenca = matriz - base;
    const acrescimo = etapa.fracao * diferenca;
    const valor = base + acrescimo;
    const linha: AnoDaTransicao = { ano: etapa.ano, fracao: etapa.fracao, base, matriz, diferenca, acrescimo, valor, variacao: base > 0 ? valor / base - 1 : null };
    base = valor;
    return linha;
  });
}

/**
 * A matriz futura de um câmpus, a partir da de hoje: a matriz do primeiro ano multiplicada por quanto os cursos do câmpus
 * rendem em cada ano, em relação ao primeiro (`valores[k] / valores[0]`). Câmpus sem ciclos projetáveis (recebe só o Piso
 * Mínimo, como São Leopoldo) fica com a matriz do primeiro ano: não há curso para projetar.
 */
export function matrizesProjetadas(matrizInicial: number, valores: readonly number[] | undefined, anos: number): number[] {
  const inicial = valores?.[0] ?? 0;
  return Array.from({ length: anos }, (_, k) => (valores && inicial > 0 ? matrizInicial * ((valores[k] ?? 0) / inicial) : matrizInicial));
}
