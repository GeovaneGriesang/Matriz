/**
 * A distribuição interna do IFSul entre os câmpus, ano a ano, pela regra da proposta oficial da Reitoria
 * (ver propostaComplementacao.ts), estendida aos anos seguintes:
 *
 *   Matriz 2: reparte o total do ano na proporção da Matriz 1 (a matriz de cada câmpus).
 *   Matriz 3: uma fração da Matriz 2: 85% em 2027 e 90% de 2028 em diante. O resto paga a complementação.
 *   Complementação, sobre o que o câmpus recebeu no ano anterior: acima dele, nada; queda de até R$ 1 milhão, completa até
 *             o valor do ano anterior; queda maior, completa até 94% dele. Nenhum câmpus fica abaixo do piso de R$ 950 mil.
 *
 * Cada ano parte do que cada câmpus recebeu no ano anterior, então os anos se encadeiam. Sem outro número, o total de um
 * ano é o total do ano anterior (o orçamento, não a soma paga: a sobra da reserva não encolhe o ano seguinte).
 */

export const REGRA_INTERNA = {
  limiteIntegral: 1_000_000,
  fracaoMinimaDoAnterior: 0.94,
  piso: 950_000,
} as const;

/** A parte da matriz que entra na Matriz 3: 85% em 2027 (o primeiro ano) e 90% de 2028 em diante. */
export function fatorDaMatriz3(ano: number): number {
  return ano <= 2027 ? 0.85 : 0.9;
}

export type RegraDoCampus = "oficial" | "acima" | "integral" | "ate-94" | "piso";

export const ROTULO_DA_REGRA: Record<RegraDoCampus, string> = {
  oficial: "valor oficial",
  acima: "acima do ano anterior",
  integral: "completado até o ano anterior",
  "ate-94": "completado até 94%",
  piso: "piso de R$ 950 mil",
};

export interface LinhaInterna {
  id: number;
  nome: string;
  /** O que o câmpus recebeu no ano anterior. */
  anterior: number;
  matriz1: number;
  matriz2: number;
  matriz3: number;
  complemento: number;
  total: number;
  regra: RegraDoCampus;
}

export interface AnoInterno {
  ano: number;
  fator: number;
  /** O total que o ano reparte (Matriz 2). */
  totalDistribuido: number;
  linhas: LinhaInterna[];
  somaMatriz3: number;
  /** O que a Matriz 3 deixa de fora para pagar a complementação. */
  reserva: number;
  somaComplemento: number;
  somaTotal: number;
}

export interface CampusInterno {
  id: number;
  nome: string;
  /** O que recebeu no ano anterior ao primeiro ano da projeção. */
  anterior: number;
}

/** Um ano da regra: reparte `total` pela Matriz 1 e aplica a complementação sobre o ano anterior. */
export function distribuirUmAno(
  campi: readonly { id: number; nome: string; anterior: number; matriz1: number }[],
  ano: number,
  total: number,
  fator: number = fatorDaMatriz3(ano),
  regra: { limiteIntegral: number; fracaoMinimaDoAnterior: number; piso: number } = REGRA_INTERNA,
): AnoInterno {
  const somaMatriz1 = campi.reduce((s, c) => s + Math.max(0, c.matriz1), 0);
  const linhas = campi.map((c): LinhaInterna => {
    const matriz2 = somaMatriz1 > 0 ? (Math.max(0, c.matriz1) / somaMatriz1) * total : 0;
    const matriz3 = fator * matriz2;
    const diferenca = matriz3 - c.anterior;
    let t: number;
    let r: RegraDoCampus;
    if (diferenca >= 0) [t, r] = [matriz3, "acima"];
    else if (-diferenca <= regra.limiteIntegral) [t, r] = [c.anterior, "integral"];
    else [t, r] = [Math.max(matriz3, regra.fracaoMinimaDoAnterior * c.anterior), "ate-94"];
    if (t < regra.piso) [t, r] = [regra.piso, "piso"];
    return { id: c.id, nome: c.nome, anterior: c.anterior, matriz1: c.matriz1, matriz2, matriz3, complemento: t - matriz3, total: t, regra: r };
  });
  const somaMatriz3 = linhas.reduce((s, l) => s + l.matriz3, 0);
  return {
    ano,
    fator,
    totalDistribuido: total,
    linhas,
    somaMatriz3,
    reserva: total - somaMatriz3,
    somaComplemento: linhas.reduce((s, l) => s + l.complemento, 0),
    somaTotal: linhas.reduce((s, l) => s + l.total, 0),
  };
}

export interface OpcoesDaProjecao {
  /** Os anos, em ordem (ex.: 2027, 2028, ...). */
  anos: readonly number[];
  campi: readonly CampusInterno[];
  /** A Matriz 1 de cada câmpus em cada ano (mesma ordem de `anos`). */
  matrizPorAno: (id: number, k: number) => number;
  /** O total de cada ano; `null` ou ausente = o total do ano anterior. */
  totais?: readonly (number | null | undefined)[];
  /** A fração da Matriz 3 de cada ano; ausente = a regra (85% em 2027, 90% depois). */
  fatores?: readonly (number | null | undefined)[];
  /** Valores já decididos de um ano (ex.: a proposta oficial de 2027): quando há, o ano usa eles e não a regra. */
  oficiais?: ReadonlyMap<number, ReadonlyMap<number, number>>;
  /** Mudança no número de alunos de cada câmpus (0,1 = 10% a mais), que vale para a Matriz 1 de todos os anos calculados. */
  ajusteDeAlunos?: Readonly<Record<string, number>>;
}

/** Encadeia os anos: o total de cada câmpus num ano é o "ano anterior" do ano seguinte. */
export function projetarDistribuicao(o: OpcoesDaProjecao): AnoInterno[] {
  const resultado: AnoInterno[] = [];
  let anterior = new Map(o.campi.map((c) => [c.id, c.anterior]));
  let totalAnterior = o.campi.reduce((s, c) => s + c.anterior, 0);
  o.anos.forEach((ano, k) => {
    const oficial = o.oficiais?.get(ano);
    if (oficial && oficial.size > 0) {
      const linhas: LinhaInterna[] = o.campi.map((c) => {
        const t = oficial.get(c.id) ?? 0;
        return { id: c.id, nome: c.nome, anterior: anterior.get(c.id) ?? 0, matriz1: o.matrizPorAno(c.id, k), matriz2: 0, matriz3: 0, complemento: 0, total: t, regra: "oficial" };
      });
      const soma = linhas.reduce((s, l) => s + l.total, 0);
      resultado.push({ ano, fator: fatorDaMatriz3(ano), totalDistribuido: soma, linhas, somaMatriz3: 0, reserva: 0, somaComplemento: 0, somaTotal: soma });
    } else {
      const total = o.totais?.[k] ?? totalAnterior;
      const fator = o.fatores?.[k] ?? fatorDaMatriz3(ano);
      const campi = o.campi.map((c) => ({
        id: c.id,
        nome: c.nome,
        anterior: anterior.get(c.id) ?? 0,
        matriz1: o.matrizPorAno(c.id, k) * (1 + (o.ajusteDeAlunos?.[String(c.id)] ?? 0)),
      }));
      resultado.push(distribuirUmAno(campi, ano, total, fator));
    }
    const feito = resultado[resultado.length - 1]!;
    anterior = new Map(feito.linhas.map((l) => [l.id, l.total]));
    // O orçamento do ano seguinte repete o do ano: a sobra da reserva não encolhe o total.
    totalAnterior = feito.totalDistribuido;
  });
  return resultado;
}

/**
 * O efeito de um ganho na matriz de um câmpus sobre a distribuição interna: a mesma projeção com e sem o ganho.
 * Como o total a repartir não muda, o que um câmpus ganha a mais sai dos outros, e a complementação pode absorver parte.
 */
export function efeitoNaDistribuicao(
  base: Omit<OpcoesDaProjecao, "matrizPorAno"> & { matriz: ReadonlyMap<number, number> },
  campusId: number,
  ganhoPorAno: readonly number[],
): { semGanho: AnoInterno[]; comGanho: AnoInterno[] } {
  const semGanho = projetarDistribuicao({ ...base, matrizPorAno: (id) => base.matriz.get(id) ?? 0 });
  // O total de cada ano fica o mesmo nas duas contas: o ganho muda a fatia, não o bolo.
  const totais = base.anos.map((_, k) => base.totais?.[k] ?? semGanho[k]!.totalDistribuido);
  const comGanho = projetarDistribuicao({ ...base, totais, matrizPorAno: (id, k) => (base.matriz.get(id) ?? 0) + (id === campusId ? (ganhoPorAno[k] ?? 0) : 0) });
  return { semGanho, comGanho };
}
