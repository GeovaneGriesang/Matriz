import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export interface MatriculaTotalEqualizadaResumo {
  unidadeId: number;
  unidadeNome: string;
  instituicaoId: number;
  instituicaoSigla: string;
  ano: number;
  matriculaTotalPresencialEqualizada: number;
  matriculaTotalEadEqualizada: number;
  matriculaTotalEadMoocEqualizada: number;
  matriculaTotalEadFpEqualizada: number;
}

/** Mesmo critério de `/api/unidades` — Reitoria/Direção Geral não têm Matrícula Total equalizada. */
function ehUnidadeAdministrativa(nome: string): boolean {
  return /^(reitoria|direção geral|direcao geral)\b/i.test(nome);
}

/** Lista todos os câmpus com a Matrícula Total equalizada do ano pedido (zerada se ainda não
 *  importada/cadastrada para aquele câmpus) — usado pela tela admin de Dados Anuais. */
export async function GET(request: NextRequest) {
  const anoParam = request.nextUrl.searchParams.get("ano");
  const ano = anoParam ? Number(anoParam) : NaN;
  if (!Number.isInteger(ano)) {
    return NextResponse.json({ errorMessage: "Parâmetro 'ano' é obrigatório e deve ser um inteiro." }, { status: 400 });
  }

  const unidades = await prisma.unidade.findMany({
    select: {
      id: true,
      nome: true,
      instituicaoId: true,
      instituicao: { select: { sigla: true } },
      matriculasTotalEqualizadas: { where: { ano }, take: 1 },
    },
    orderBy: [{ instituicao: { sigla: "asc" } }, { nome: "asc" }],
  });

  const resumo: MatriculaTotalEqualizadaResumo[] = unidades
    .filter((u) => !ehUnidadeAdministrativa(u.nome))
    .map((u) => {
      const registro = u.matriculasTotalEqualizadas[0];
      return {
        unidadeId: u.id,
        unidadeNome: u.nome,
        instituicaoId: u.instituicaoId,
        instituicaoSigla: u.instituicao.sigla,
        ano,
        matriculaTotalPresencialEqualizada: registro ? Number(registro.matriculaTotalPresencialEqualizada) : 0,
        matriculaTotalEadEqualizada: registro ? Number(registro.matriculaTotalEadEqualizada) : 0,
        matriculaTotalEadMoocEqualizada: registro ? Number(registro.matriculaTotalEadMoocEqualizada) : 0,
        matriculaTotalEadFpEqualizada: registro ? Number(registro.matriculaTotalEadFpEqualizada) : 0,
      };
    });

  return NextResponse.json(resumo);
}
