import { NextResponse } from "next/server";
import { solicitarCancelamento } from "@/server/ingestionProgress";
import { requireAdminSessionOrResponse } from "@/server/auth/session";

/** Sinaliza para o pipeline de ingestão em andamento (via `ingestionProgress`) que deve parar e reverter. */
export async function POST(request: Request) {
  const naoAutenticado = await requireAdminSessionOrResponse();
  if (naoAutenticado) return naoAutenticado;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return NextResponse.json({ ok: false, errorMessage: "Parâmetro 'id' é obrigatório." }, { status: 400 });
  }

  const encontrado = solicitarCancelamento(body.id);
  return NextResponse.json({ ok: encontrado });
}
