"use server";

import { revalidatePath } from "next/cache";
import type { Papel } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { registrarAuditoria } from "@/server/auth/auditoria";
import { criarCodigoVerificacao } from "@/server/auth/codigos";
import { perfisQueMeuPapelCria, podeGerirUsuarios } from "@/lib/permissoes";
import { ehEmailInstitucional, MENSAGEM_SO_INSTITUCIONAL } from "@/lib/emailInstitucional";
import { nomeCurtoDaUnidade } from "@/lib/campusDoUsuario";
import { enviarEmailCadastro, enviarEmailNovoPedidoDeAcesso, enviarEmailPedidoRecusado } from "@/server/email/enviar";

export interface ResultadoPedido {
  ok: boolean;
  errorMessage?: string;
  aviso?: string;
  /** Só na aprovação, e só se o e-mail falhar: o código de primeiro acesso, para repassar por outro meio. */
  codigoGerado?: string;
}

/** Mais que isso de pedidos pendentes criados na última hora, a tela para de aceitar por um tempo (proteção contra envio em massa). */
const LIMITE_PEDIDOS_POR_HORA = 30;

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/** O id de uma unidade do IFSul (um câmpus ou a Reitoria); qualquer outra coisa é inválida (undefined). */
async function unidadeDoPedido(valor: FormDataEntryValue | null): Promise<number | undefined> {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const u = await prisma.unidade.findFirst({ where: { id, instituicao: { sigla: "IFSUL" } }, select: { id: true } });
  return u?.id ?? undefined;
}

/**
 * Server Action pública: a própria pessoa pede acesso, com nome, e-mail institucional e câmpus. Não cria conta: grava o pedido e
 * avisa o super-admin por e-mail. E-mail de fora do domínio do IFSul é recusado na hora, sem gravar nada.
 */
export async function pedirAcessoAction(formData: FormData): Promise<ResultadoPedido> {
  // Campo escondido: gente não preenche, robô de formulário sim.
  if (String(formData.get("site") ?? "") !== "") return { ok: true };

  const nome = String(formData.get("nome") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 500) || null;

  if (!nome) return { ok: false, errorMessage: "Informe o seu nome." };
  if (!email.includes("@")) return { ok: false, errorMessage: "Informe o seu e-mail institucional." };
  if (!ehEmailInstitucional(email)) return { ok: false, errorMessage: MENSAGEM_SO_INSTITUCIONAL };
  const unidadeId = await unidadeDoPedido(formData.get("unidadeId"));
  if (unidadeId === undefined) return { ok: false, errorMessage: "Escolha o seu câmpus (ou a Reitoria)." };

  const conta = await prisma.usuario.findUnique({ where: { email }, select: { ativo: true } });
  if (conta?.ativo) {
    return { ok: false, errorMessage: "Já existe uma conta com este e-mail. Para entrar sem lembrar a senha, use Recuperar acesso na tela de entrada." };
  }
  if (conta) return { ok: false, errorMessage: "A conta com este e-mail está desativada. Fale com a administração do sistema." };

  const pendente = await prisma.pedidoAcesso.findFirst({ where: { email, situacao: "PENDENTE" }, select: { criadoEm: true } });
  if (pendente) {
    return { ok: false, errorMessage: `Já há um pedido seu, de ${formatoData.format(pendente.criadoEm)}, aguardando análise. Você recebe um e-mail quando ele for decidido.` };
  }

  const naUltimaHora = await prisma.pedidoAcesso.count({ where: { criadoEm: { gt: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (naUltimaHora >= LIMITE_PEDIDOS_POR_HORA) return { ok: false, errorMessage: "Muitos pedidos neste momento. Tente de novo daqui a uma hora." };

  const pedido = await prisma.pedidoAcesso.create({ data: { nome, email, unidadeId, motivo }, include: { unidade: true } });
  await registrarAuditoria(null, "pedir_acesso", { pedidoId: pedido.id, email });
  revalidatePath("/admin/usuarios");

  const aprovadores = await prisma.usuario.findMany({ where: { papel: "SUPER_ADMIN", ativo: true }, select: { email: true } });
  try {
    await enviarEmailNovoPedidoDeAcesso(aprovadores, {
      nome,
      email,
      campus: pedido.unidade ? nomeCurtoDaUnidade(pedido.unidade.nome) : "não informado",
      motivo,
    });
  } catch {
    // O pedido já está gravado e aparece na tela Usuários; sem o aviso por e-mail, ele só é visto quando alguém abrir a tela.
  }
  return { ok: true };
}

async function pedidoPendente(formData: FormData) {
  const id = Number(formData.get("pedidoId"));
  if (!Number.isInteger(id)) return null;
  return prisma.pedidoAcesso.findFirst({ where: { id, situacao: "PENDENTE" } });
}

/**
 * Server Action (super-admin, ou administrador para o perfil padrão) que aprova um pedido: cria a conta com o perfil e o câmpus
 * escolhidos (o padrão é o perfil Padrão e o câmpus que a pessoa informou) e manda o código de primeiro acesso ao e-mail.
 */
export async function aprovarPedidoAcessoAction(formData: FormData): Promise<ResultadoPedido> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };
  if (!podeGerirUsuarios(solicitante.papel)) return { ok: false, errorMessage: "Você não tem permissão para aprovar pedidos." };

  const pedido = await pedidoPendente(formData);
  if (!pedido) return { ok: false, errorMessage: "Pedido não encontrado ou já decidido." };
  const papel = String(formData.get("papel") ?? "PADRAO") as Papel;
  if (!perfisQueMeuPapelCria(solicitante.papel).includes(papel)) {
    return { ok: false, errorMessage: "Só o super-admin aprova com o perfil de administrador." };
  }
  const unidadeId = await unidadeDoPedido(formData.get("unidadeId"));
  if (unidadeId === undefined) return { ok: false, errorMessage: "Escolha o câmpus (ou a Reitoria)." };
  if (await prisma.usuario.findUnique({ where: { email: pedido.email } })) {
    return { ok: false, errorMessage: `Já existe uma conta com o e-mail ${pedido.email}.` };
  }

  const novo = await prisma.usuario.create({ data: { email: pedido.email, nome: pedido.nome, papel, senhaHash: null, unidadeId } });
  await prisma.pedidoAcesso.update({ where: { id: pedido.id }, data: { situacao: "APROVADO", decididoEm: new Date(), decididoPorId: solicitante.id } });
  const codigo = await criarCodigoVerificacao(novo.id, "PRIMEIRO_ACESSO");
  await registrarAuditoria(solicitante.id, "aprovar_pedido_acesso", { pedidoId: pedido.id, usuarioAlvoId: novo.id, email: pedido.email, papel, unidadeId });
  revalidatePath("/admin/usuarios");

  try {
    await enviarEmailCadastro({ email: novo.email, nome: novo.nome }, codigo, true);
    return { ok: true };
  } catch (erro) {
    return {
      ok: true,
      codigoGerado: codigo,
      aviso: `Pedido aprovado, mas o e-mail não pôde ser enviado (${erro instanceof Error ? erro.message : "erro desconhecido"}). Repasse o código a seguir por outro meio.`,
    };
  }
}

/** Server Action (administrador ou super-admin) que recusa um pedido e avisa a pessoa por e-mail. Nenhuma conta é criada. */
export async function recusarPedidoAcessoAction(formData: FormData): Promise<ResultadoPedido> {
  const solicitante = await getAdminSession();
  if (!solicitante) return { ok: false, errorMessage: "Não autenticado." };
  if (!podeGerirUsuarios(solicitante.papel)) return { ok: false, errorMessage: "Você não tem permissão para recusar pedidos." };

  const pedido = await pedidoPendente(formData);
  if (!pedido) return { ok: false, errorMessage: "Pedido não encontrado ou já decidido." };
  await prisma.pedidoAcesso.update({ where: { id: pedido.id }, data: { situacao: "RECUSADO", decididoEm: new Date(), decididoPorId: solicitante.id } });
  await registrarAuditoria(solicitante.id, "recusar_pedido_acesso", { pedidoId: pedido.id, email: pedido.email });
  revalidatePath("/admin/usuarios");

  try {
    await enviarEmailPedidoRecusado({ email: pedido.email, nome: pedido.nome });
    return { ok: true };
  } catch {
    return { ok: true, aviso: `Pedido recusado, mas o e-mail para ${pedido.email} não pôde ser enviado.` };
  }
}
