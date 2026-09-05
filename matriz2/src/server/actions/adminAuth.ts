"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import {
  ADMIN_SESSION_COOKIE_NAME,
  abrirSessaoParaUsuario,
  apagarSessaoAtual,
  getAdminSession,
} from "@/server/auth/session";
import { registrarAuditoria } from "@/server/auth/auditoria";

export interface LoginActionResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * Server Action que autentica por e-mail e senha, cria a sessão no banco e grava o
 * cookie com o token opaco. Substitui a senha única compartilhada da rodada
 * anterior: agora cada pessoa tem sua própria conta, o que é pré-requisito para
 * troca/reset de senha e para a auditoria dizerem QUEM fez o quê.
 */
export async function loginAction(formData: FormData): Promise<LoginActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = formData.get("senha");

  if (!email || typeof senha !== "string" || senha.length === 0) {
    return { ok: false, errorMessage: "Informe e-mail e senha." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  // Mesma mensagem de erro para "e-mail não existe" e "senha errada", de propósito:
  // uma mensagem diferente para cada caso confirmaria a um invasor quais e-mails
  // têm conta no sistema.
  const MENSAGEM_GENERICA = "E-mail ou senha incorretos.";
  if (!usuario || !usuario.ativo) {
    return { ok: false, errorMessage: MENSAGEM_GENERICA };
  }

  if (!usuario.senhaHash) {
    return {
      ok: false,
      errorMessage: "Você ainda não concluiu o primeiro acesso. Veja o código enviado por e-mail e complete em /admin/definir-senha.",
    };
  }

  const confere = await bcrypt.compare(senha, usuario.senhaHash);
  if (!confere) {
    return { ok: false, errorMessage: MENSAGEM_GENERICA };
  }

  // Sessões expiradas do mesmo usuário não custam nada guardadas, mas limpar aqui
  // mantém a tabela pequena sem precisar de uma tarefa agendada separada.
  await prisma.sessao.deleteMany({ where: { usuarioId: usuario.id, expiraEm: { lte: new Date() } } });
  await abrirSessaoParaUsuario(usuario.id);

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLoginEm: new Date() } });
  await registrarAuditoria(usuario.id, "login");

  return { ok: true };
}

/** Server Action que apaga a sessão (banco e cookie) e volta para o login. */
export async function logoutAction(): Promise<void> {
  const usuario = await getAdminSession();
  await apagarSessaoAtual();
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
  if (usuario) await registrarAuditoria(usuario.id, "logout");
  redirect("/admin/login");
}
