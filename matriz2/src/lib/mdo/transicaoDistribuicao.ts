/**
 * Transição da distribuição entre os câmpus de uma instituição: sair do que cada câmpus
 * recebeu no ano anterior (o valor INFORMADO) até a distribuição pela matriz, em alguns
 * anos, sem tirar tudo de quem perde de uma vez.
 *
 * Em cada ano, o orçamento da instituição se reparte em três partes, cujos percentuais
 * somam 100:
 *
 *   mantido  distribuído na mesma proporção do valor informado no ano anterior
 *            (é a "âncora": quem recebia mais continua recebendo mais);
 *   índice   distribuído pela matriz de cada câmpus ponderada por um índice de qualidade e
 *            eficiência escolhido (ex.: eficiência acadêmica): premia o câmpus que entrega
 *            mais resultado por matrícula;
 *   matriz   distribuído só pela matriz (matrícula equalizada), a regra final.
 *
 * O último ano de um plano de transição termina com `matriz` em 100%.
 *
 * A conta conserva o dinheiro: a soma dos câmpus é sempre o total informado, em todos os
 * anos e em qualquer plano. É isso que impede o simulador de "criar" orçamento.
 */

export interface CampusDistribuicao {
  id: number;
  nome: string;
  /** Valor que o câmpus recebeu no ano anterior (informado). Zero se o câmpus é novo. */
  informado: number;
  /** Valor que a matriz atribui ao câmpus no ano simulado. */
  matriz: number;
  /** Multiplicador de qualidade e eficiência do câmpus (1 = neutro). */
  indice: number;
}

export interface PlanoAno {
  /** Percentual do orçamento distribuído pelo informado do ano anterior (0 a 100). */
  mantidoPct: number;
  /** Percentual distribuído pela matriz ponderada pelo índice (0 a 100). */
  indicePct: number;
}

/** O que sobra depois do mantido e do índice: a parte distribuída só pela matriz. */
export function matrizPct(plano: PlanoAno): number {
  return 100 - plano.mantidoPct - plano.indicePct;
}

export function planoValido(plano: PlanoAno): boolean {
  return plano.mantidoPct >= 0 && plano.indicePct >= 0 && matrizPct(plano) >= -1e-9;
}

/**
 * Plano que desce em linha reta até a matriz pura no último ano.
 *
 * `mantidoInicial` é o percentual mantido no primeiro ano (ex.: 80). `pesoDoIndice` é
 * a fração (0 a 1) do que NÃO é mantido que vai pelo índice, também caindo até zero no
 * último ano.
 */
export function planoLinear(mantidoInicial: number, pesoDoIndice: number, anos: number): PlanoAno[] {
  const plano: PlanoAno[] = [];
  for (let ano = 1; ano <= anos; ano++) {
    const fator = anos > 1 ? (anos - ano) / (anos - 1) : 0;
    const mantido = mantidoInicial * fator;
    plano.push({ mantidoPct: mantido, indicePct: (100 - mantido) * pesoDoIndice * fator });
  }
  return plano;
}

export interface ResultadoAno {
  plano: PlanoAno;
  matrizPct: number;
  /** Valor de cada câmpus, na mesma ordem de `campi`. */
  valores: number[];
  /** Fatia de cada câmpus no total (0 a 1). */
  fatias: number[];
}

function fatiasPor(pesos: number[]): number[] {
  const soma = pesos.reduce((s, p) => s + p, 0);
  return soma > 0 ? pesos.map((p) => p / soma) : pesos.map(() => 0);
}

export function distribuirAno(campi: CampusDistribuicao[], total: number, plano: PlanoAno): ResultadoAno {
  if (!planoValido(plano)) throw new Error("Plano inválido: os percentuais precisam somar no máximo 100.");
  const pInformado = fatiasPor(campi.map((c) => c.informado));
  const pMatriz = fatiasPor(campi.map((c) => c.matriz));
  const pIndice = fatiasPor(campi.map((c) => c.matriz * c.indice));

  // Sem valor informado (primeiro ano do sistema, por exemplo), a parte "mantida" não tem
  // como ser distribuída; cai na matriz em vez de sumir com dinheiro.
  const temInformado = pInformado.some((f) => f > 0);
  const temIndice = pIndice.some((f) => f > 0);
  let mantido = plano.mantidoPct / 100;
  let indice = plano.indicePct / 100;
  let matriz = matrizPct(plano) / 100;
  if (!temInformado) {
    matriz += mantido;
    mantido = 0;
  }
  if (!temIndice) {
    matriz += indice;
    indice = 0;
  }

  const fatias = campi.map((_, i) => mantido * pInformado[i]! + indice * pIndice[i]! + matriz * pMatriz[i]!);
  return {
    plano,
    matrizPct: matrizPct(plano),
    fatias,
    valores: fatias.map((f) => f * total),
  };
}

export interface ResultadoTransicao {
  anos: ResultadoAno[];
  /** Para cada ano, a soma dos câmpus (deve ser igual ao total: a conta conserva o dinheiro). */
  somaPorAno: number[];
}

export function simularTransicao(
  campi: CampusDistribuicao[],
  totalPorAno: number[],
  planos: PlanoAno[],
): ResultadoTransicao {
  const anos = planos.map((plano, i) => distribuirAno(campi, totalPorAno[i] ?? totalPorAno[totalPorAno.length - 1] ?? 0, plano));
  return { anos, somaPorAno: anos.map((a) => a.valores.reduce((s, v) => s + v, 0)) };
}
