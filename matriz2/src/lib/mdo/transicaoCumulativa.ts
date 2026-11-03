/**
 * As duas propostas de transição apresentadas por câmpus do IFSul têm a mesma conta, com percentuais diferentes:
 *
 *   V(ano) = V(ano anterior) + fração × (M(ano) − V(ano anterior))
 *
 * V é o valor distribuído ao câmpus e M, a referência da Matriz SETEC-CONIF no mesmo ano. Os percentuais incidem sobre a
 * diferença que ainda resta até a matriz daquele ano, e não sobre a diferença de 2026: por isso o efeito é cumulativo. "95% do
 * ano anterior mais 5% da matriz", como escreve a proposta de Venâncio Aires, é a mesma conta com fração de 5%.
 *
 * A conta NÃO conserva o total: cada câmpus anda em direção à própria matriz, sem repartir um orçamento fixo. A tela mostra a
 * diferença entre a soma dos câmpus e a soma da matriz em vez de escondê-la.
 */

export interface EtapaTransicao {
  ano: number;
  /** Fração da diferença até a matriz do ano que é incorporada (0 a 1). */
  fracao: number;
}

export interface PropostaDeTransicao {
  id: string;
  campus: string;
  /** O título do documento, como está nele. */
  documento: string;
  etapas: readonly EtapaTransicao[];
  /** A regra, em uma frase. */
  regra: string;
  /** O que a tela precisa avisar para a simulação não ser lida como mais do que é. */
  ressalvas: readonly string[];
}

export const PROPOSTAS_DE_TRANSICAO: readonly PropostaDeTransicao[] = [
  {
    id: "sapucaia",
    campus: "Câmpus Sapucaia do Sul",
    documento: "Proposta de adoção da Matriz Orçamentária SETEC-CONIF para distribuição de orçamento entre Câmpus do IFSul",
    etapas: [
      { ano: 2027, fracao: 0.33 },
      { ano: 2028, fracao: 0.66 },
      { ano: 2029, fracao: 1 },
    ],
    regra: "Em 2027, incorpora 33% da diferença até a matriz; em 2028, 66% da diferença que restou; em 2029, adota a matriz inteira.",
    ressalvas: ["O exemplo do documento usa R$ 4.057.568,49 como matriz de 2027 do Câmpus Sapucaia do Sul; a 5ª fase usada aqui traz R$ 3.665.124,96."],
  },
  {
    id: "venancio-aires",
    campus: "Câmpus Venâncio Aires",
    documento: "Contribuição do Câmpus Venâncio Aires para a proposta de distribuição da matriz orçamentária, 2027-2030",
    etapas: [
      { ano: 2027, fracao: 0 },
      { ano: 2028, fracao: 0.05 },
      { ano: 2029, fracao: 0.1 },
      { ano: 2030, fracao: 0.2 },
    ],
    regra: "Em 2027, mantém o orçamento de 2026; depois, incorpora 5%, 10% e 20% da diferença até a matriz, sobre o valor do ano anterior. Até 2030 fecha 31,6% da diferença, e a metodologia é reavaliada ao final.",
    ressalvas: [
      "As tabelas do documento usam uma matriz anterior (soma de R$ 40.883.731,04) e corrigem o orçamento de 2026 em 1,17%. Aqui vale a matriz de 2027 da 5ª fase, como o documento recomenda quando ela estivesse disponível, e o orçamento de 2026 fica sem correção. Por isso os valores diferem das tabelas do documento.",
      "O modelo misto do documento (frota, prédios, estrutura agrícola) não tem peso nem fórmula: esta simulação considera só o valor anterior e a matriz.",
      "O Câmpus São Leopoldo não consta das tabelas do documento; sem valor em 2026, aqui ele parte de zero.",
    ],
  },
];

const ETAPAS_SAPUCAIA = PROPOSTAS_DE_TRANSICAO[0]!.etapas;

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
export function transicaoDoCampus(baseInicial: number, matrizes: readonly number[], etapas: readonly EtapaTransicao[] = ETAPAS_SAPUCAIA): AnoDaTransicao[] {
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
