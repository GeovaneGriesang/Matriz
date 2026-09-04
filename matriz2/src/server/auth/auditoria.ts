import { headers } from "next/headers";
import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Grava uma linha em `RegistroAuditoria`. Chamada por toda ação sensível (login,
 * logout, troca de senha, correção manual de dados) — é o que responde "quem
 * mudou o quê, e quando", pedido explicitamente pelo usuário.
 *
 * O IP vem do cabeçalho `x-forwarded-for` (o Caddy da VM está na frente da
 * aplicação); localmente, sem esse cabeçalho, fica `null`.
 */
export async function registrarAuditoria(
  usuarioId: number | null,
  acao: string,
  detalhe?: Prisma.InputJsonValue,
): Promise<void> {
  const cabecalhos = await headers();
  const ip = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await prisma.registroAuditoria.create({
    data: { usuarioId, acao, detalhe, ip },
  });
}
