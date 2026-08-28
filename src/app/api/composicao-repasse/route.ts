import { NextResponse, type NextRequest } from "next/server";
import type { CategoriaRepasse } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

export interface ComposicaoRepasseLinha {
  id: number;
  modalidadeEnsino: string;
  fonteFinanciamento: string;
  categoriaRepasse: CategoriaRepasse;
  peso: number;
}

export interface ComposicaoRepasseResposta {
  ano: number;
  linhas: ComposicaoRepasseLinha[];
  /** Anos que já têm composição cadastrada, para o seletor da tela. */
  anosDisponiveis: number[];
}

/**
 * Lista a Composição de Repasse de um ano (vazia quando o ano ainda não foi cadastrado) e os anos
 * que já existem — usado pela tela admin /admin/composicao-repasse.
 */
export async function GET(request: NextRequest) {
  const anoParam = request.nextUrl.searchParams.get("ano");
  const ano = anoParam ? Number(anoParam) : NaN;
  if (!Number.isInteger(ano)) {
    return NextResponse.json({ error: "Parâmetro 'ano' inválido." }, { status: 400 });
  }

  const [linhas, anos] = await Promise.all([
    prisma.composicaoRepasseAnual.findMany({
      where: { ano },
      orderBy: [{ modalidadeEnsino: "asc" }, { fonteFinanciamento: "asc" }],
      select: {
        id: true,
        modalidadeEnsino: true,
        fonteFinanciamento: true,
        categoriaRepasse: true,
        peso: true,
      },
    }),
    prisma.composicaoRepasseAnual.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } }),
  ]);

  const resposta: ComposicaoRepasseResposta = {
    ano,
    linhas: linhas.map((l) => ({ ...l, peso: Number(l.peso) })),
    anosDisponiveis: anos.map((a) => a.ano),
  };
  return NextResponse.json(resposta);
}
