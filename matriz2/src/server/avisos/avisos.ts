import { prisma } from "@/server/db/prisma";
import { enviarEmailAviso } from "@/server/email/enviar";

/**
 * Os avisos do sistema, o "robô azul": cada vez que uma fonte oficial muda, que uma carga grava dados novos ou que uma versão
 * nova é publicada, fica um aviso em /avisos e sai um e-mail para os super-admins. O e-mail só sai do servidor de produção
 * (APP_URL com https), para que testes locais não mandem mensagem a ninguém.
 */
export type TipoDeAviso = "fonte" | "carga" | "versao";

export const ROTULO_DO_AVISO: Record<TipoDeAviso, string> = {
  fonte: "Fonte oficial mudou",
  carga: "Dados carregados",
  versao: "Nova versão do sistema",
};

export function avisosPorEmailAtivos(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

export async function registrarAviso(a: { tipo: TipoDeAviso; titulo: string; texto: string; link?: string; referencia?: string }) {
  // SEM_AVISO=1 roda uma carga ou conferência sem avisar (ex.: refazer o ponto de partida das fontes).
  if (process.env.SEM_AVISO === "1") return null;
  const aviso = await prisma.avisoDoSistema.create({
    data: { tipo: a.tipo, titulo: a.titulo.slice(0, 200), texto: a.texto, link: a.link ?? null, referencia: a.referencia ?? null },
  });
  if (!avisosPorEmailAtivos()) return aviso;
  try {
    const destinos = await prisma.usuario.findMany({ where: { papel: "SUPER_ADMIN", ativo: true }, select: { email: true, nome: true } });
    if (destinos.length > 0) await enviarEmailAviso(destinos, { ...aviso, rotulo: ROTULO_DO_AVISO[a.tipo] });
    await prisma.avisoDoSistema.update({ where: { id: aviso.id }, data: { emailEnviadoEm: new Date() } });
  } catch (e) {
    await prisma.avisoDoSistema.update({ where: { id: aviso.id }, data: { emailErro: (e instanceof Error ? e.message : String(e)).slice(0, 500) } });
  }
  return aviso;
}

/** Aviso de uma carga de dados: chamado no fim de cada script de carga, com o resumo que o script já imprime. */
export async function avisarCarga(titulo: string, linhas: readonly string[], link?: string) {
  await registrarAviso({ tipo: "carga", titulo, texto: linhas.join("\n"), link });
}

export async function quantosAvisosNovos(usuario: { id: number }): Promise<number> {
  const u = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { avisosVistosEm: true, criadoEm: true } });
  if (!u) return 0;
  return prisma.avisoDoSistema.count({ where: { criadoEm: { gt: u.avisosVistosEm ?? u.criadoEm } } });
}
