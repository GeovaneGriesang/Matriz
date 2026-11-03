/**
 * Valor de 2027 gravado em "Valores recebidos" a pedido do usuário (2026-11-03), antes de o Colégio de Dirigentes decidir: é o que a
 * transição proposta daria, não o que o câmpus recebeu. A observação começa com esta marca, e as telas que tratam o informado como
 * dinheiro depositado usam a marca para avisar.
 */
export const MARCA_VALOR_PROPOSTO = "Proposta ao CODIR, não aprovada";

export function ehValorProposto(observacao: string | null | undefined): boolean {
  return (observacao ?? "").startsWith(MARCA_VALOR_PROPOSTO);
}
