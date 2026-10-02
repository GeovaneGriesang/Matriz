/**
 * O IFSul é a instituição de quem usa o sistema: nas tabelas e nas listas de instituições ele aparece sempre primeiro e
 * em destaque, para não ser preciso procurá-lo entre as 42 da rede.
 */
export const SIGLA_DESTAQUE = "IFSUL";

export function ehInstituicaoDestaque(sigla: string): boolean {
  return sigla.toUpperCase().replace(/[^A-Z]/g, "") === SIGLA_DESTAQUE;
}

/** Põe a instituição em destaque na frente de uma lista, mantendo a ordem das demais. */
export function destaqueNaFrente<T>(itens: T[], sigla: (item: T) => string): T[] {
  return [...itens.filter((i) => ehInstituicaoDestaque(sigla(i))), ...itens.filter((i) => !ehInstituicaoDestaque(sigla(i)))];
}
