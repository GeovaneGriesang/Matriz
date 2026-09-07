"use server";

import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { registrarAuditoria } from "@/server/auth/auditoria";

export interface SalvarValorRecebidoResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * Server Action (admin ou super-admin) que grava quanto um câmpus REALMENTE
 * recebeu num ano, informado à mão. Ao contrário da correção manual de
 * `CicloOrcamento`, isto não sobrescreve nem é sobrescrito por `npm run carregar`:
 * é um fato independente da matriz da MDO, que só muda quando alguém volta aqui e
 * edita. `upsert` porque o mesmo (ano, câmpus) pode ser corrigido depois, por
 * exemplo quando o valor definitivo sai.
 */
export async function salvarValorRecebidoAction(formData: FormData): Promise<SalvarValorRecebidoResult> {
  const usuario = await getAdminSession();
  if (!usuario) {
    return { ok: false, errorMessage: "Não autenticado." };
  }
  if (usuario.papel === "PADRAO") {
    return { ok: false, errorMessage: "Você não tem permissão para fazer isso." };
  }

  const ano = Number(formData.get("ano"));
  const unidadeId = Number(formData.get("unidadeId"));
  const valorBruto = formData.get("valorRecebido");
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!Number.isFinite(ano) || ano < 2000) {
    return { ok: false, errorMessage: "Ano inválido." };
  }
  if (!Number.isFinite(unidadeId) || unidadeId <= 0) {
    return { ok: false, errorMessage: "Escolha um câmpus." };
  }
  const valorRecebido = Number(valorBruto);
  if (valorBruto === null || valorBruto === "" || !Number.isFinite(valorRecebido) || valorRecebido < 0) {
    return { ok: false, errorMessage: "Informe um valor recebido válido." };
  }

  const unidade = await prisma.unidade.findUnique({ where: { id: unidadeId } });
  if (!unidade) {
    return { ok: false, errorMessage: "Câmpus não encontrado." };
  }

  await prisma.valorRecebidoCampus.upsert({
    where: { ano_unidadeId: { ano, unidadeId } },
    create: {
      ano,
      unidadeId,
      valorRecebido,
      observacao: observacao || null,
      registradoPorId: usuario.id,
    },
    update: {
      valorRecebido,
      observacao: observacao || null,
      registradoPorId: usuario.id,
    },
  });

  await registrarAuditoria(usuario.id, "informar_valor_recebido", { ano, unidadeId, valorRecebido });

  return { ok: true };
}

/** Apaga um valor recebido informado, para quando foi digitado por engano. */
export async function excluirValorRecebidoAction(id: number): Promise<SalvarValorRecebidoResult> {
  const usuario = await getAdminSession();
  if (!usuario) {
    return { ok: false, errorMessage: "Não autenticado." };
  }
  if (usuario.papel === "PADRAO") {
    return { ok: false, errorMessage: "Você não tem permissão para fazer isso." };
  }

  const registro = await prisma.valorRecebidoCampus.findUnique({ where: { id } });
  if (!registro) {
    return { ok: false, errorMessage: "Registro não encontrado." };
  }

  await prisma.valorRecebidoCampus.delete({ where: { id } });
  await registrarAuditoria(usuario.id, "excluir_valor_recebido", { ano: registro.ano, unidadeId: registro.unidadeId });

  return { ok: true };
}
