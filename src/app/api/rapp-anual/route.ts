import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";
import { calcularRapAproximadoPorInstituicao } from "@/server/dadosAnuais/valoresCalculados";

export interface RappAnualResumo {
  instituicaoId: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  ano: number;
  rapp: number;
  origem: "PLANILHA" | "CONFIGURADO" | null;
  /** RAP Presencial aproximado a partir da PNP (ano-base - 2), com os números brutos do cálculo,
   *  para comparação e memória de cálculo — ver calcularRapAproximadoPorInstituicao. `null` quando
   *  a PNP não tem dado para calcular. */
  rapCalculado: { matriculasPresenciais: number; professorEquivalente: number; razaoDocenteAluno: number } | null;
}

/** Lista todas as instituições com o RAPP (RAP Presencial oficial) do ano pedido (zerado se ainda
 *  não importado/cadastrado para aquela instituição) — usado pela tela admin de Dados Anuais e pela
 *  consulta pública de Dados importados. */
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

  const rapCalculadoPorInstituicao = await calcularRapAproximadoPorInstituicao(
    ano - DEFASAGEM_ANOS_REFERENCIA_PNP,
    instituicoes.map((i) => i.id),
  );

  const resumo: RappAnualResumo[] = instituicoes.map((i) => ({
    instituicaoId: i.id,
    instituicaoSigla: i.sigla,
    instituicaoNome: i.nome,
    ano,
    rapp: i.rappAnual[0] ? Number(i.rappAnual[0].rapp) : 0,
    origem: i.rappAnual[0]?.origem ?? null,
    rapCalculado: rapCalculadoPorInstituicao.get(i.id) ?? null,
  }));

  return NextResponse.json(resumo);
}
