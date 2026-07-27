import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export interface EficienciaAcademicaAnualResumo {
  instituicaoId: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  ano: number;
  conclusaoCiclo: number;
  evasaoCiclo: number;
  retencaoCiclo: number;
  eficienciaAcademica: number;
}

/** Lista todas as instituições com Conclusão/Evasão/Retenção de Ciclo e Eficiência Acadêmica do ano
 *  pedido (zerados se ainda não importados/cadastrados para aquela instituição) — usado pela tela
 *  admin de Dados Anuais. */
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
      eficienciaAcademicaAnual: { where: { ano }, take: 1 },
    },
    orderBy: { sigla: "asc" },
  });

  const resumo: EficienciaAcademicaAnualResumo[] = instituicoes.map((i) => {
    const registro = i.eficienciaAcademicaAnual[0];
    return {
      instituicaoId: i.id,
      instituicaoSigla: i.sigla,
      instituicaoNome: i.nome,
      ano,
      conclusaoCiclo: registro ? Number(registro.conclusaoCiclo) : 0,
      evasaoCiclo: registro ? Number(registro.evasaoCiclo) : 0,
      retencaoCiclo: registro ? Number(registro.retencaoCiclo) : 0,
      eficienciaAcademica: registro ? Number(registro.eficienciaAcademica) : 0,
    };
  });

  return NextResponse.json(resumo);
}
