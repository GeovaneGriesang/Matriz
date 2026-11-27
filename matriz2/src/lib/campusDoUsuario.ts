import type { Papel } from "@prisma/client";

/**
 * O câmpus a que cada usuário pertence abre as telas próprias daquele câmpus. Hoje só há uma: o orçamento do município de
 * Venâncio Aires, aberta a quem é do câmpus Venâncio Aires. O super-admin vê todas.
 */
export const CAMPUS_VENANCIO_AIRES = "CAMPUS VENÂNCIO AIRES";

/** "CAMPUS VENÂNCIO AIRES" vira "Venâncio Aires"; "REITORIA" vira "Reitoria". */
export function nomeCurtoDaUnidade(nome: string): string {
  const sem = nome.replace(/^CAMPUS\s+/i, "");
  return sem
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && ["de", "do", "da", "dos", "das", "e"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** Se a pessoa pode abrir uma tela reservada a um câmpus. */
export function podeVerTelaDoCampus(papel: Papel, campusDoUsuario: string | null | undefined, campusDaTela: string): boolean {
  return papel === "SUPER_ADMIN" || campusDoUsuario === campusDaTela;
}
