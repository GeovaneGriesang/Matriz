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
