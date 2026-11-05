import type { AjusteDeTela } from "@/lib/menu";
import { prisma } from "@/server/db/prisma";

/** O que o super-admin mudou nas telas de cada perfil. Sem nenhuma linha, vale a pré-configuração de `lib/menu.ts`. */
export async function carregarAjustesDeTelas(): Promise<AjusteDeTela[]> {
  const linhas = await prisma.visibilidadeDaTela.findMany({ select: { papel: true, href: true, visivel: true } });
  return linhas.flatMap((l) => (l.papel === "SUPER_ADMIN" ? [] : [{ papel: l.papel, href: l.href, visivel: l.visivel }]));
}
