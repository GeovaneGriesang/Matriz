"use server";

import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";

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

  await prisma.unidade.update({ where: { id: unidadeId }, data: { anoCriacao } });

  return { ok: true };
}
