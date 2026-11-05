"use server";

import { revalidatePath } from "next/cache";
import { ajustesDasMarcacoes } from "@/lib/menu";
import { podeEscolherTelasDosPerfis } from "@/lib/permissoes";
import { registrarAuditoria } from "@/server/auth/auditoria";
import { getAdminSession } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export interface ResultadoTelasPorPerfil {
  ok: boolean;
  errorMessage?: string;
}

/** Grava as telas de cada perfil. Só o super-admin. Guarda apenas o que difere da pré-configuração, trocando tudo de uma vez. */
export async function salvarTelasPorPerfilAction(marcadas: string[]): Promise<ResultadoTelasPorPerfil> {
  const usuario = await getAdminSession();
  if (!usuario) return { ok: false, errorMessage: "Não autenticado." };
  if (!podeEscolherTelasDosPerfis(usuario.papel)) return { ok: false, errorMessage: "Só o super-admin escolhe as telas de cada perfil." };
  if (!Array.isArray(marcadas)) return { ok: false, errorMessage: "Marcações inválidas." };

  const ajustes = ajustesDasMarcacoes(marcadas);
  await prisma.$transaction([prisma.visibilidadeDaTela.deleteMany(), prisma.visibilidadeDaTela.createMany({ data: ajustes })]);
  await registrarAuditoria(usuario.id, "configurar_telas_por_perfil", { diferencasDaPreConfiguracao: ajustes.map((a) => ({ ...a })) });

  // O menu está no layout de todas as telas.
  revalidatePath("/", "layout");
  return { ok: true };
}
