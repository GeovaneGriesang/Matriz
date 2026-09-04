"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { registrarAuditoria } from "@/server/auth/auditoria";

const CUSTO_BCRYPT = 12;

export interface ResultadoUsuario {
  ok: boolean;
  errorMessage?: string;
  /** Só presente quando uma senha nova foi gerada (criação e reset) — mostrada uma única vez. */
  senhaGerada?: string;
}

function gerarSenhaTemporaria(): string {
  // 12 bytes aleatórios em base64url dão uma senha de 16 caracteres, sem
  // caracteres ambíguos de digitar (nada de "+/=" do base64 comum).
  return randomBytes(12).toString("base64url");
}

/** Server Action (só super-admin) que cria um novo usuário com senha gerada. */
export async function criarUsuarioAction(formData: FormData): Promise<ResultadoUsuario> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };
  if (!solicitante.superAdmin) return { ok: false, errorMessage: "Só um super-administrador pode criar usuários." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const superAdmin = formData.get("superAdmin") === "on";

  if (!email || !email.includes("@")) return { ok: false, errorMessage: "Informe um e-mail válido." };
  if (!nome) return { ok: false, errorMessage: "Informe o nome." };

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return { ok: false, errorMessage: `Já existe um usuário com o e-mail ${email}.` };

  const senha = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);

  const novo = await prisma.usuario.create({ data: { email, nome, senhaHash, superAdmin } });
  await registrarAuditoria(solicitante.id, "criar_usuario", { usuarioAlvoId: novo.id, email, superAdmin });

  return { ok: true, senhaGerada: senha };
}

/**
 * Server Action (só super-admin) que reseta a senha de outro usuário para uma nova
 * senha gerada, sem precisar da senha antiga. É a resposta a "esqueci a senha"
 * combinada com o usuário: sem e-mail de recuperação, o reset é sempre feito por
 * quem já tem acesso de super-admin.
 */
export async function resetarSenhaUsuarioAction(formData: FormData): Promise<ResultadoUsuario> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };
  if (!solicitante.superAdmin) return { ok: false, errorMessage: "Só um super-administrador pode resetar senhas." };

  const usuarioAlvoId = Number(formData.get("usuarioId"));
  if (!Number.isInteger(usuarioAlvoId)) return { ok: false, errorMessage: "Usuário inválido." };

  const alvo = await prisma.usuario.findUnique({ where: { id: usuarioAlvoId } });
  if (!alvo) return { ok: false, errorMessage: "Usuário não encontrado." };

  const senha = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);

  await prisma.usuario.update({ where: { id: usuarioAlvoId }, data: { senhaHash } });
  // Resetar a senha derruba todas as sessões abertas daquele usuário — se alguém
  // mais tinha acesso à conta, o reset também serve para tirá-lo.
  await prisma.sessao.deleteMany({ where: { usuarioId: usuarioAlvoId } });
  await registrarAuditoria(solicitante.id, "resetar_senha_usuario", { usuarioAlvoId, email: alvo.email });

  return { ok: true, senhaGerada: senha };
}

/** Server Action (só super-admin) que ativa ou desativa outro usuário, sem apagá-lo. */
export async function alternarAtivoUsuarioAction(formData: FormData): Promise<ResultadoUsuario> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };
  if (!solicitante.superAdmin) return { ok: false, errorMessage: "Só um super-administrador pode fazer isso." };

  const usuarioAlvoId = Number(formData.get("usuarioId"));
  if (!Number.isInteger(usuarioAlvoId)) return { ok: false, errorMessage: "Usuário inválido." };
  if (usuarioAlvoId === solicitante.id) return { ok: false, errorMessage: "Você não pode desativar sua própria conta." };

  const alvo = await prisma.usuario.findUnique({ where: { id: usuarioAlvoId } });
  if (!alvo) return { ok: false, errorMessage: "Usuário não encontrado." };

  const ativo = !alvo.ativo;
  await prisma.usuario.update({ where: { id: usuarioAlvoId }, data: { ativo } });
  if (!ativo) await prisma.sessao.deleteMany({ where: { usuarioId: usuarioAlvoId } });
  await registrarAuditoria(solicitante.id, ativo ? "reativar_usuario" : "desativar_usuario", {
    usuarioAlvoId,
    email: alvo.email,
  });

  return { ok: true };
}

export interface TrocarSenhaResult {
  ok: boolean;
  errorMessage?: string;
}

/** Server Action (autosserviço) que troca a própria senha, exigindo a senha atual. */
export async function trocarMinhaSenhaAction(formData: FormData): Promise<TrocarSenhaResult> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const senhaNova = String(formData.get("senhaNova") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senhaNova.length < 8) return { ok: false, errorMessage: "A nova senha precisa de pelo menos 8 caracteres." };
  if (senhaNova !== confirmacao) return { ok: false, errorMessage: "A confirmação não confere com a nova senha." };

  const usuario = await prisma.usuario.findUnique({ where: { id: solicitante.id } });
  if (!usuario) return { ok: false, errorMessage: "Usuário não encontrado." };

  const confere = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!confere) return { ok: false, errorMessage: "Senha atual incorreta." };

  const senhaHash = await bcrypt.hash(senhaNova, CUSTO_BCRYPT);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
  await registrarAuditoria(usuario.id, "trocar_senha");

  return { ok: true };
}
