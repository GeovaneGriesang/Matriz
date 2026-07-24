import { prisma } from "@/server/db/prisma";

export type EscopoDistribuicao = "TODAS" | "CONIF";

/**
 * `Instituicao.organizacaoAcademica` (dado literal da PNP) que compõem o CONIF — Conselho Nacional
 * das Instituições da Rede Federal: 38 Institutos Federais, CEFET-MG, CEFET-RJ e Colégio Pedro II
 * (41 no total). "Todas as instituições federais" inclui também as 23 escolas técnicas vinculadas a
 * universidades federais (ex: COLTEC/UFMG, CTUR/UFRRJ), totalizando 64.
 */
const ORGANIZACOES_CONIF = ["Instituto Federal", "Centro Federal de Educação Tecnológica", "Colégio Pedro II"];

export interface InstituicaoDoEscopo {
  id: number;
  sigla: string;
  nome: string;
}

/** Instituições do escopo escolhido que já têm dados da PNP do ano de referência importados. */
export async function listarInstituicoesDoEscopo(
  escopo: EscopoDistribuicao,
  anoReferenciaPnp: number,
): Promise<InstituicaoDoEscopo[]> {
  const candidatos = await prisma.fatoIndicador.findMany({
    where: { ano: anoReferenciaPnp },
    distinct: ["instituicaoId"],
    select: { instituicaoId: true },
  });

  return prisma.instituicao.findMany({
    where: {
      id: { in: candidatos.map((c) => c.instituicaoId) },
      ...(escopo === "CONIF" ? { organizacaoAcademica: { in: ORGANIZACOES_CONIF } } : {}),
    },
    select: { id: true, sigla: true, nome: true },
    orderBy: { sigla: "asc" },
  });
}
