import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db/prisma";

export interface OrcamentoDistribuidoOficialResumo {
  instituicaoId: number;
  instituicaoSigla: string;
  instituicaoNome: string;
  ano: number;
  custeioOficial: number;
  assistenciaOficial: number;
  /** Base pré-trava (aba COMPARATIVO, colunas AF/AK) — 0 quando ainda não importada/cadastrada. */
  custeioBaseOficial: number;
  assistenciaBaseOficial: number;
  /** Custeio e Assistência são gravados em tabelas separadas e podem ter origens diferentes
   *  (ex.: um importado via planilha, o outro corrigido à mão depois). */
  origemCusteio: "PLANILHA" | "CONFIGURADO" | null;
  origemAssistencia: "PLANILHA" | "CONFIGURADO" | null;
}

/** Lista todas as instituições com o Custeio/Assistência Estudantil oficiais (com complemento da
 *  trava de não-decréscimo) do ano pedido — zerado se ainda não importado/cadastrado para aquela
 *  instituição. Usado pela tela admin de Dados Anuais. */
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
      custeioDistribuidoOficial: { where: { ano }, take: 1 },
      assistenciaDistribuidoOficial: { where: { ano }, take: 1 },
    },
    orderBy: { sigla: "asc" },
  });

  const resumo: OrcamentoDistribuidoOficialResumo[] = instituicoes.map((i) => ({
    instituicaoId: i.id,
    instituicaoSigla: i.sigla,
    instituicaoNome: i.nome,
    ano,
    custeioOficial: i.custeioDistribuidoOficial[0] ? Number(i.custeioDistribuidoOficial[0].custeioOficial) : 0,
    assistenciaOficial: i.assistenciaDistribuidoOficial[0]
      ? Number(i.assistenciaDistribuidoOficial[0].assistenciaOficial)
      : 0,
    custeioBaseOficial:
      i.custeioDistribuidoOficial[0]?.custeioBaseOficial !== null &&
      i.custeioDistribuidoOficial[0]?.custeioBaseOficial !== undefined
        ? Number(i.custeioDistribuidoOficial[0].custeioBaseOficial)
        : 0,
    assistenciaBaseOficial:
      i.assistenciaDistribuidoOficial[0]?.assistenciaBaseOficial !== null &&
      i.assistenciaDistribuidoOficial[0]?.assistenciaBaseOficial !== undefined
        ? Number(i.assistenciaDistribuidoOficial[0].assistenciaBaseOficial)
        : 0,
    origemCusteio: i.custeioDistribuidoOficial[0]?.origem ?? null,
    origemAssistencia: i.assistenciaDistribuidoOficial[0]?.origem ?? null,
  }));

  return NextResponse.json(resumo);
}
