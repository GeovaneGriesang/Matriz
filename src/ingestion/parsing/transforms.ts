/** Converte um número no formato brasileiro (vírgula decimal, ponto de milhar) para `number`. */
export function parseDecimalBr(raw: string): number {
  const normalizado = raw.trim().replace(/\./g, "").replace(",", ".");
  const valor = Number(normalizado);
  if (Number.isNaN(valor)) {
    throw new Error(`Valor numérico inválido: "${raw}"`);
  }
  return valor;
}

/**
 * Como `parseDecimalBr`, mas célula vazia vira `null` em vez de lançar —
 * a maioria das medidas dos exports PNP fica em branco quando não há dado
 * para aquela combinação de dimensões (ex: Oferta de Vagas Noturnas de um
 * câmpus sem curso noturno).
 */
export function parseDecimalBrOptional(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  return parseDecimalBr(trimmed);
}

export function identity(raw: string): string {
  return raw.trim();
}

/**
 * Como `parseDecimalBrOptional`, mas divide o resultado por 100 — a PNP exporta os valores
 * absolutos de "Matrícula Equivalente" de `PercentuaisLegais.csv` (Geral/Técnicos/Formação de
 * Professores/Proeja) 100x maiores que o valor real, confirmado cruzando com `DadosGerais.csv`
 * em múltiplos câmpus (ver Achado 6 de docs/pnp-matriz/Comparacao_CSV_vs_Matriz_5aFase.md). Os
 * percentuais (%ME) não são afetados pelo bug (numerador e denominador inflados igualmente) — só
 * os valores absolutos precisam dessa correção.
 */
export function parseDecimalBrOptionalEscala100(raw: string): number | null {
  const valor = parseDecimalBrOptional(raw);
  return valor === null ? null : valor / 100;
}
