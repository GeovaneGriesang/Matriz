import { NextResponse } from "next/server";
import { obterProgresso } from "@/server/ingestionProgress";

/** Consultado via polling pelo formulário de upload para mostrar linhas processadas e status. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ errorMessage: "Parâmetro 'id' é obrigatório." }, { status: 400 });
  }

  const progresso = obterProgresso(id);
  if (!progresso) {
    return NextResponse.json({ errorMessage: "Progresso não encontrado." }, { status: 404 });
  }

  return NextResponse.json(progresso);
}
