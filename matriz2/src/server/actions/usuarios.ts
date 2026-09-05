"use server";

import bcrypt from "bcryptjs";
import { randomBytes, randomInt, createHash } from "node:crypto";
import type { Papel, TipoCodigoVerificacao } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getAdminSession, abrirSessaoParaUsuario } from "@/server/auth/session";
import { registrarAuditoria } from "@/server/auth/auditoria";
import { validarForcaSenha } from "@/lib/senha";
import { enviarEmailCadastro, enviarEmailRecuperacao } from "@/server/email/enviar";

const CUSTO_BCRYPT = 12;
const VALIDADE_CODIGO_MS = 30 * 60 * 1000;

export interface ResultadoUsuario {
  ok: boolean;
  errorMessage?: string;
  /** Presente com `ok: true` quando algo merece atenção mesmo com sucesso (ex.: e-mail não enviado). */
  aviso?: string;
  /** Só no reset manual (a reserva sem e-mail) — mostrada uma única vez. */
  senhaGerada?: string;
  /** Só na criação de conta, e só se o e-mail falhar — para o super-admin repassar à mão. */
  codigoGerado?: string;
}

function gerarSenhaTemporaria(): string {
  // 12 bytes aleatórios em base64url dão uma senha de 16 caracteres, sem
  // caracteres ambíguos de digitar (nada de "+/=" do base64 comum).
  return randomBytes(12).toString("base64url");
}

function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

async function criarCodigoVerificacao(usuarioId: number, tipo: TipoCodigoVerificacao): Promise<string> {
  const codigo = gerarCodigo();
  await prisma.codigoVerificacao.create({
    data: {
      usuarioId,
      tipo,
      codigoHash: hashCodigo(codigo),
      expiraEm: new Date(Date.now() + VALIDADE_CODIGO_MS),
    },
  });
  return codigo;
}

/**
 * Server Action (só super-admin) que cria um novo usuário e manda o e-mail de
 * primeiro acesso. Sem senha gerada: a conta fica sem `senhaHash` até a pessoa
 * concluir `/admin/definir-senha` com o código recebido (decisão do usuário em
 * 2026-09-05). Se o envio falhar (ex.: Resend ainda não configurado), o cadastro
 * não se perde — devolve o código para o super-admin repassar à mão.
 *
 * Só cria ADMIN ou PADRAO, nunca SUPER_ADMIN: ninguém precisa saber que esse papel
 * existe (decisão do usuário em 2026-09-05), então o app nunca oferece criá-lo — só
 * nasce pelo script `seedSuperAdmin.ts`, fora da interface.
 */
export async function criarUsuarioAction(formData: FormData): Promise<ResultadoUsuario> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };
  if (solicitante.papel !== "SUPER_ADMIN") {
    return { ok: false, errorMessage: "Você não tem permissão para criar usuários." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const papel = String(formData.get("papel") ?? "") as Papel;

  if (!email || !email.includes("@")) return { ok: false, errorMessage: "Informe um e-mail válido." };
  if (!nome) return { ok: false, errorMessage: "Informe o nome." };
  if (!["ADMIN", "PADRAO"].includes(papel)) {
    return { ok: false, errorMessage: "Selecione um papel válido." };
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) return { ok: false, errorMessage: `Já existe um usuário com o e-mail ${email}.` };

  const novo = await prisma.usuario.create({ data: { email, nome, papel, senhaHash: null } });
  const codigo = await criarCodigoVerificacao(novo.id, "PRIMEIRO_ACESSO");
  await registrarAuditoria(solicitante.id, "criar_usuario", { usuarioAlvoId: novo.id, email, papel });

  try {
    await enviarEmailCadastro({ email, nome }, codigo);
    return { ok: true };
  } catch (erro) {
    return {
      ok: true,
      codigoGerado: codigo,
      aviso:
        "Usuário criado, mas o e-mail não pôde ser enviado " +
        `(${erro instanceof Error ? erro.message : "erro desconhecido"}). Repasse o código a seguir por outro meio.`,
    };
  }
}

/**
 * Server Action (só super-admin) que reseta a senha de outro usuário para uma nova
 * senha gerada, sem precisar da senha antiga. É a reserva sem depender de e-mail
 * (decisão do usuário em 2026-09-05): a recuperação normal usa código por e-mail
 * (`solicitarRecuperacaoSenhaAction`), mas esta continua existindo para quando o
 * e-mail não for uma opção.
 */
export async function resetarSenhaUsuarioAction(formData: FormData): Promise<ResultadoUsuario> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };
  if (solicitante.papel !== "SUPER_ADMIN") {
    return { ok: false, errorMessage: "Você não tem permissão para resetar senhas." };
  }

  const usuarioAlvoId = Number(formData.get("usuarioId"));
  if (!Number.isInteger(usuarioAlvoId)) return { ok: false, errorMessage: "Usuário inválido." };

  const alvo = await prisma.usuario.findUnique({ where: { id: usuarioAlvoId } });
  if (!alvo) return { ok: false, errorMessage: "Usuário não encontrado." };

  const senha = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);

  await prisma.usuario.update({ where: { id: usuarioAlvoId }, data: { senhaHash, precisaTrocarSenha: true } });
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
  if (solicitante.papel !== "SUPER_ADMIN") {
    return { ok: false, errorMessage: "Você não tem permissão para fazer isso." };
  }

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

  const erroForca = validarForcaSenha(senhaNova);
  if (erroForca) return { ok: false, errorMessage: erroForca };
  if (senhaNova !== confirmacao) return { ok: false, errorMessage: "A confirmação não confere com a nova senha." };

  const usuario = await prisma.usuario.findUnique({ where: { id: solicitante.id } });
  if (!usuario?.senhaHash) return { ok: false, errorMessage: "Usuário não encontrado." };

  const confere = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!confere) return { ok: false, errorMessage: "Senha atual incorreta." };

  const senhaHash = await bcrypt.hash(senhaNova, CUSTO_BCRYPT);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash, precisaTrocarSenha: false } });
  await registrarAuditoria(usuario.id, "trocar_senha");

  return { ok: true };
}

export interface DefinirSenhaResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * Server Action pública (sem sessão) que conclui o primeiro acesso ou uma
 * recuperação de senha: confere o código enviado por e-mail, valida a força da
 * senha nova e já loga a pessoa. Mesma ação para os dois casos — a diferença é só
 * qual e-mail chegou antes (cadastro ou "esqueci minha senha").
 *
 * Mensagem de erro sempre genérica: não diz se o e-mail existe, se o código é que
 * está errado ou se expirou, para não dar pista a quem está tentando adivinhar.
 */
export async function definirSenhaAction(formData: FormData): Promise<DefinirSenhaResult> {
  const GENERICO = "Código inválido ou expirado. Confira o e-mail e peça um novo código, se precisar.";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const codigo = String(formData.get("codigo") ?? "").trim();
  const senhaNova = String(formData.get("senhaNova") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (!email || !codigo) return { ok: false, errorMessage: GENERICO };

  const erroForca = validarForcaSenha(senhaNova);
  if (erroForca) return { ok: false, errorMessage: erroForca };
  if (senhaNova !== confirmacao) return { ok: false, errorMessage: "A confirmação não confere com a nova senha." };

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) return { ok: false, errorMessage: GENERICO };

  const pendente = await prisma.codigoVerificacao.findFirst({
    where: { usuarioId: usuario.id, usadoEm: null, expiraEm: { gt: new Date() } },
    orderBy: { criadoEm: "desc" },
  });
  if (!pendente || pendente.codigoHash !== hashCodigo(codigo)) {
    return { ok: false, errorMessage: GENERICO };
  }

  const senhaHash = await bcrypt.hash(senhaNova, CUSTO_BCRYPT);
  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash, precisaTrocarSenha: false } }),
    prisma.codigoVerificacao.update({ where: { id: pendente.id }, data: { usadoEm: new Date() } }),
  ]);
  await registrarAuditoria(
    usuario.id,
    pendente.tipo === "PRIMEIRO_ACESSO" ? "concluir_primeiro_acesso" : "concluir_recuperacao_senha",
  );

  await abrirSessaoParaUsuario(usuario.id);
  return { ok: true };
}

export interface SolicitarRecuperacaoResult {
  ok: boolean;
}

/**
 * Server Action pública que inicia a recuperação de senha por e-mail. Sempre
 * responde sucesso, exista ou não a conta — quem chama mostra a mesma mensagem nos
 * dois casos, para não revelar quais e-mails têm cadastro.
 */
export async function solicitarRecuperacaoSenhaAction(formData: FormData): Promise<SolicitarRecuperacaoResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: true };

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) return { ok: true };

  const codigo = await criarCodigoVerificacao(usuario.id, "RECUPERACAO_SENHA");
  await registrarAuditoria(usuario.id, "solicitar_recuperacao_senha");
  try {
    await enviarEmailRecuperacao({ email: usuario.email, nome: usuario.nome }, codigo);
  } catch {
    // Falha de envio não muda a resposta (ver comentário acima) — fica só o código
    // salvo (com hash) no banco; sem e-mail, essa recuperação específica não segue
    // adiante, mas o pedido em si não pode denunciar se a conta existe.
  }
  return { ok: true };
}
