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

/**
 * Dentro do IFSul, o câmpus de quem usa o sistema é o Venâncio Aires: ele é o câmpus padrão e vem sempre primeiro nas listas e
 * tabelas de câmpus, em destaque. O nome vem da MDO ("CAMPUS VENÂNCIO AIRES"), então a comparação ignora acento e caixa.
 */
export function ehCampusDestaque(nome: string): boolean {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().includes("VENANCIO AIRES");
}

/** Põe o câmpus em destaque na frente de uma lista, mantendo a ordem dos demais. */
export function campusDestaqueNaFrente<T>(itens: T[], nome: (item: T) => string): T[] {
  return [...itens.filter((i) => ehCampusDestaque(nome(i))), ...itens.filter((i) => !ehCampusDestaque(nome(i)))];
}
