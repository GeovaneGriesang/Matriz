interface FaixaLegal {
  /** %ME mínimo (inclusivo) para esta faixa. */
  min: number;
  peso: number;
}

/** Técnicos: %ME < 50% -> peso 0 · 50%-60% -> peso 1x · >= 60% -> peso 2x. */
export const IAPL_FAIXAS_TECNICOS: FaixaLegal[] = [
  { min: 0, peso: 0 },
  { min: 0.5, peso: 1 },
  { min: 0.6, peso: 2 },
];

/** Formação de Professores: <10% -> 0 · 10%-15% -> 1x · 15%-20% -> 2x · >= 20% -> 2,5x. */
export const IAPL_FAIXAS_FORMACAO_PROFESSORES: FaixaLegal[] = [
  { min: 0, peso: 0 },
  { min: 0.1, peso: 1 },
  { min: 0.15, peso: 2 },
  { min: 0.2, peso: 2.5 },
];

/** Proeja: <2,5% -> 0 · 2,5%-5% -> 1x · 5%-10% -> 2x · >= 10% -> 2,5x. */
export const IAPL_FAIXAS_PROEJA: FaixaLegal[] = [
  { min: 0, peso: 0 },
  { min: 0.025, peso: 1 },
  { min: 0.05, peso: 2 },
  { min: 0.1, peso: 2.5 },
];

/** Enquadra um %ME (0–1) na faixa de peso mais alta cujo piso mínimo o valor atinge. */
export function pesoPorFaixaLegal(percentualMe: number, faixas: FaixaLegal[]): number {
  let peso = faixas[0]!.peso;
  for (const faixa of faixas) {
    if (percentualMe >= faixa.min) {
      peso = faixa.peso;
    } else {
      break;
    }
  }
  return peso;
}

export function pesoIaplTecnicos(percentualMe: number): number {
  return pesoPorFaixaLegal(percentualMe, IAPL_FAIXAS_TECNICOS);
}

export function pesoIaplFormacaoProfessores(percentualMe: number): number {
  return pesoPorFaixaLegal(percentualMe, IAPL_FAIXAS_FORMACAO_PROFESSORES);
}

export function pesoIaplProeja(percentualMe: number): number {
  return pesoPorFaixaLegal(percentualMe, IAPL_FAIXAS_PROEJA);
}
