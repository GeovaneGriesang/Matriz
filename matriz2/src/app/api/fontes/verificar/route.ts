import { NextResponse } from "next/server";
import { requireAdminSessionOrResponse } from "@/server/auth/session";
import { verificarFontes } from "@/server/fontes/verificarFontes";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/fontes/verificar: confere agora as fontes oficiais (a mesma conferência que roda toda segunda-feira). */
export async function POST() {
  const negado = await requireAdminSessionOrResponse();
  if (negado) return negado;
  const r = await verificarFontes();
  return NextResponse.json({ mudaram: r.filter((x) => x.mudou).length, erros: r.filter((x) => x.erro).length });
}
