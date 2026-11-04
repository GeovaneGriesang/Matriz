/**
 * O curso escolhido viaja entre as abas de "Quanto vale um curso" pelo parâmetro `curso` do endereço (revisão de 2026-11-04). Ele chega em dois formatos: o da tabela de
 * pesos ("TECNICO|INTEGRADO|TECNICO EM INFORMATICA|1200") e o da aba do integrado, que parte dos cursos do câmpus ("TECNICO EM INFORMATICA|INTEGRADO").
 */
export function cursoDaChave(chave: string | undefined): { curso: string; oferta: string } | null {
  if (!chave) return null;
  const partes = chave.split("|");
  if (partes.length === 4 && partes[2]) return { curso: partes[2], oferta: partes[1] ?? "" };
  if (partes.length === 2 && partes[0]) return { curso: partes[0], oferta: partes[1] ?? "" };
  return null;
}

/** "TECNICO EM INFORMATICA (integrado)". */
export function rotuloDoCursoEscolhido(c: { curso: string; oferta: string }): string {
  return `${c.curso}${c.oferta && c.oferta !== "NÃO SE APLICA" && c.oferta !== "*" ? ` (${c.oferta.toLowerCase()})` : ""}`;
}
