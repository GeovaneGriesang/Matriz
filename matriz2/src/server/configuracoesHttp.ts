import { NextResponse } from "next/server";
import { getAdminSession } from "@/server/auth/session";
import type { Ator } from "@/lib/configuracoes/regras";
import type { Resultado } from "@/server/configuracoes";

/** O usuário da sessão, no formato que as regras de configurações salvas usam; null se não houver sessão. */
export async function atorDaSessao(): Promise<Ator | null> {
  const u = await getAdminSession();
  return u ? { id: u.id, papel: u.papel } : null;
}

export function naoAutenticado() {
  return NextResponse.json({ erro: "Entre no sistema para usar as simulações salvas." }, { status: 401 });
}

export function responder<T>(r: Resultado<T>) {
  if (r.ok) return NextResponse.json(r.valor);
  return NextResponse.json({ erro: r.erro, conflito: r.conflito }, { status: r.status });
}

/** O corpo JSON da requisição, ou null se vier inválido. */
export async function corpoJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const c = await req.json();
    return c && typeof c === "object" ? (c as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function idDaRota(texto: string): number | null {
  const n = Number(texto);
  return Number.isInteger(n) && n > 0 ? n : null;
}
