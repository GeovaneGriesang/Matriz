/** Converte um número no formato brasileiro (vírgula decimal, ponto de milhar) para `number`. */
export function parseDecimalBr(raw: string): number {
  const normalizado = raw.trim().replace(/\./g, "").replace(",", ".");
  const valor = Number(normalizado);
  if (Number.isNaN(valor)) {
    throw new Error(`Valor numérico inválido: "${raw}"`);
  }
  return valor;
}

/** Converte uma data no formato dd/mm/aaaa (padrão dos extratos da PNP) para `Date`. */
export function parseDataBr(raw: string): Date {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) {
    throw new Error(`Data inválida (esperado dd/mm/aaaa): "${raw}"`);
  }
  const [, dia, mes, ano] = match;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  return data;
}

export function parseInteiro(raw: string): number {
  const valor = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(valor)) {
    throw new Error(`Valor inteiro inválido: "${raw}"`);
  }
  return valor;
}

export function identity(raw: string): string {
  return raw.trim();
}
