"use server";

import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { ehUnidadeAdministrativa } from "@/server/unidades/unidadeAdministrativa";

export interface SalvarAnoCriacaoUnidadeResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * Server Action (admin) que grava o ano de criação de um câmpus — cadastro manual, já que essa
 * informação não existe em nenhum arquivo PNP ingerido. Usado só pelo Piso Mínimo por Câmpus Novo
 * (ver aplicarPisoMinimoCampusNovo.ts). `anoCriacao` vazio limpa o campo (câmpus sem ano conhecido
 * nunca é elegível ao piso).
 */
export async function salvarAnoCriacaoUnidadeAction(formData: FormData): Promise<SalvarAnoCriacaoUnidadeResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const unidadeId = Number(formData.get("unidadeId"));
  if (!Number.isInteger(unidadeId) || unidadeId <= 0) {
    return { ok: false, errorMessage: "Câmpus inválido." };
  }

  const anoCriacaoBruto = formData.get("anoCriacao");
  const anoCriacao = anoCriacaoBruto === null || anoCriacaoBruto === "" ? null : Number(anoCriacaoBruto);
  if (anoCriacao !== null && (!Number.isInteger(anoCriacao) || anoCriacao < 1900 || anoCriacao > 2100)) {
    return { ok: false, errorMessage: "Ano de criação inválido." };
  }

  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId }, select: { nome: true } });
  if (!unidade) {
    return { ok: false, errorMessage: "Câmpus inválido." };
  }
  if (ehUnidadeAdministrativa(unidade.nome)) {
    return { ok: false, errorMessage: "Reitoria/Direção Geral não têm ano de criação de câmpus." };
  }

  await prisma.unidade.update({ where: { id: unidadeId }, data: { anoCriacao } });

  return { ok: true };
}

export interface CriarUnidadeResult {
  ok: boolean;
  errorMessage?: string;
  unidadeId?: number;
}

/**
 * Server Action (admin) que cadastra um câmpus à mão.
 *
 * Necessária porque as unidades normalmente nascem da ingestão dos arquivos da PNP — e um câmpus
 * recém-criado ainda **não tem matrícula**, logo não aparece em nenhum arquivo da PNP e nunca seria
 * criado sozinho. Só que a matriz da CONIF já o contempla: ele entra pelo Piso Mínimo por Câmpus
 * Novo, recebendo o valor do piso mesmo sem alunos.
 *
 * O tamanho do buraco, medido em 2026-08-28 contra a planilha do ciclo 2027: dos 53 câmpus que
 * recebem o piso, 41 não existiam no sistema (todos criados em 2026) — R$ 28,7 milhões que a
 * planilha distribui e o sistema não conseguia atribuir a ninguém.
 *
 * O câmpus criado aqui não recebe nenhum fato da PNP; entra no cálculo apenas pelo piso, e passa a
 * receber dados normalmente quando aparecer num arquivo futuro (a ingestão casa por
 * instituição + nome, então não duplica).
 */
export async function criarUnidadeAction(formData: FormData): Promise<CriarUnidadeResult> {
  if (!(await getAdminSession())) {
    return { ok: false, errorMessage: "Não autenticado." };
  }

  const instituicaoId = Number(formData.get("instituicaoId"));
  if (!Number.isInteger(instituicaoId) || instituicaoId <= 0) {
    return { ok: false, errorMessage: "Selecione a instituição." };
  }

  const nome = String(formData.get("nome") ?? "").trim().replace(/\s+/g, " ");
  if (nome === "") {
    return { ok: false, errorMessage: "Informe o nome do câmpus." };
  }
  if (ehUnidadeAdministrativa(nome)) {
    return {
      ok: false,
      errorMessage: "Reitoria e Direção Geral são unidades administrativas e não entram nesta tela.",
    };
  }

  const anoCriacaoBruto = formData.get("anoCriacao");
  const anoCriacao = anoCriacaoBruto === null || anoCriacaoBruto === "" ? null : Number(anoCriacaoBruto);
  if (anoCriacao !== null && (!Number.isInteger(anoCriacao) || anoCriacao < 1900 || anoCriacao > 2100)) {
    return { ok: false, errorMessage: "Ano de criação inválido." };
  }

  const instituicao = await prisma.instituicao.findUnique({ where: { id: instituicaoId }, select: { id: true } });
  if (instituicao === null) {
    return { ok: false, errorMessage: "Instituição não encontrada." };
  }

  // A ingestão casa unidade por (instituição, nome) — cadastrar um nome que já existe criaria um
  // câmpus fantasma que jamais receberia dados da PNP, então é recusado em vez de duplicado.
  const jaExiste = await prisma.unidade.findUnique({
    where: { instituicaoId_nome: { instituicaoId, nome } },
    select: { id: true },
  });
  if (jaExiste !== null) {
    return { ok: false, errorMessage: `Esta instituição já tem um câmpus chamado "${nome}".` };
  }

  const criada = await prisma.unidade.create({
    data: { instituicaoId, nome, anoCriacao },
    select: { id: true },
  });

  return { ok: true, unidadeId: criada.id };
}
