import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

export interface UnidadeResumo {
  id: number;
  nome: string;
  anoCriacao: number | null;
  instituicaoId: number;
  instituicaoSigla: string;
}

/** Reitoria/Direção Geral são unidades administrativas (sem matrícula, sem Bloco Funcionamento) — não fazem
 * sentido na tela de ano de criação por câmpus. Identificadas pelo nome porque o PNP não distingue por um
 * campo próprio (mesmo padrão em todas as ~40 instituições ingeridas: "Reitoria do ..." / "Direção Geral do ...").
 */
function ehUnidadeAdministrativa(nome: string): boolean {
  return /^(reitoria|direção geral|direcao geral)\b/i.test(nome);
}

/** Lista os câmpus (Unidade) com seu ano de criação — usado pela tela admin de cadastro manual. */
export async function GET() {
  const unidades = await prisma.unidade.findMany({
    select: {
      id: true,
      nome: true,
      anoCriacao: true,
      instituicaoId: true,
      instituicao: { select: { sigla: true } },
    },
    orderBy: [{ instituicao: { sigla: "asc" } }, { nome: "asc" }],
  });

  const resumo: UnidadeResumo[] = unidades
    .filter((u) => !ehUnidadeAdministrativa(u.nome))
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      anoCriacao: u.anoCriacao,
      instituicaoId: u.instituicaoId,
      instituicaoSigla: u.instituicao.sigla,
    }));

  return NextResponse.json(resumo);
}
