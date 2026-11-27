import { randomInt, createHash } from "node:crypto";
import type { TipoCodigoVerificacao } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

/** O código de uso único mandado por e-mail (primeiro acesso ou recuperação de senha). Só o hash fica no banco. */
export const VALIDADE_CODIGO_MS = 30 * 60 * 1000;

function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

export async function criarCodigoVerificacao(usuarioId: number, tipo: TipoCodigoVerificacao): Promise<string> {
  const codigo = gerarCodigo();
  await prisma.codigoVerificacao.create({
    data: { usuarioId, tipo, codigoHash: hashCodigo(codigo), expiraEm: new Date(Date.now() + VALIDADE_CODIGO_MS) },
  });
  return codigo;
}
