/**
 * Valor de 2027 gravado em "Valores recebidos" a pedido (2026-11-03), pela proposta do Câmpus Sapucaia do Sul: é o que a
 * transição proposta daria, não o que o câmpus recebeu. A observação começa com esta marca, e as telas que tratam o informado como
 * dinheiro depositado usam a marca para avisar.
 */
export const MARCA_VALOR_PROPOSTO = "Proposta do Câmpus Sapucaia do Sul, não aprovada";

/** A marca com que os valores foram gravados primeiro; a carga a troca pela atual. */
const MARCA_ANTERIOR = "Proposta ao CODIR, não aprovada";

export function ehValorProposto(observacao: string | null | undefined): boolean {
  const texto = observacao ?? "";
  return texto.startsWith(MARCA_VALOR_PROPOSTO) || texto.startsWith(MARCA_ANTERIOR);
}
