import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export interface RappAnualResumo {
  instituicaoId: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  ano: number;
  rapp: number;
}

/** Lista todas as instituições com o RAPP (RAP Presencial oficial) do ano pedido (zerado se ainda
 *  não importado/cadastrado para aquela instituição) — usado pela tela admin de Dados Anuais. */
export async function GET(request: NextRequest) {
  const anoParam = request.nextUrl.searchParams.get("ano");
  const ano = anoParam ? Number(anoParam) : NaN;
  if (!Number.isInteger(ano)) {
    return NextResponse.json({ errorMessage: "Parâmetro 'ano' é obrigatório e deve ser um inteiro." }, { status: 400 });
  }

  const instituicoes = await prisma.instituicao.findMany({
    select: {
      id: true,
      sigla: true,
      nome: true,
      rappAnual: { where: { ano }, take: 1 },
    },
    orderBy: { sigla: "asc" },
  });

  const resumo: RappAnualResumo[] = instituicoes.map((i) => ({
    instituicaoId: i.id,
    instituicaoSigla: i.sigla,
    instituicaoNome: i.nome,
    ano,
    rapp: i.rappAnual[0] ? Number(i.rappAnual[0].rapp) : 0,
  }));

  return NextResponse.json(resumo);
}
