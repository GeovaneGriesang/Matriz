import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";
import { calcularEficienciaAcademicaAproximadaPorInstituicao } from "@/server/dadosAnuais/valoresCalculados";

export interface EficienciaAcademicaAnualResumo {
  instituicaoId: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  ano: number;
  conclusaoCiclo: number;
  evasaoCiclo: number;
  retencaoCiclo: number;
  eficienciaAcademica: number;
  origem: "PLANILHA" | "CONFIGURADO" | null;
  /** Concluídos/Evadidos/Retidos (contagens brutas) e Conclusão/Evasão/Retenção de Ciclo e IEA
   *  aproximados a partir da PNP (ano-base - 2), para comparação e memória de cálculo — ver
   *  calcularEficienciaAcademicaAproximadaPorInstituicao. `null` quando a PNP não tem dado para
   *  calcular. */
  eficienciaAcademicaCalculada: {
    concluidos: number;
    evadidos: number;
    retidos: number;
    conclusaoCiclo: number;
    evasaoCiclo: number;
    retencaoCiclo: number;
    eficienciaAcademica: number;
  } | null;
}

/** Lista todas as instituições com Conclusão/Evasão/Retenção de Ciclo e Eficiência Acadêmica do ano
 *  pedido (zerados se ainda não importados/cadastrados para aquela instituição) — usado pela tela
 *  admin de Dados Anuais e pela consulta pública de Dados importados. */
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

  const eficienciaCalculadaPorInstituicao = await calcularEficienciaAcademicaAproximadaPorInstituicao(
    ano - DEFASAGEM_ANOS_REFERENCIA_PNP,
    instituicoes.map((i) => i.id),
  );

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
      origem: registro?.origem ?? null,
      eficienciaAcademicaCalculada: eficienciaCalculadaPorInstituicao.get(i.id) ?? null,
    };
  });

  return NextResponse.json(resumo);
}
