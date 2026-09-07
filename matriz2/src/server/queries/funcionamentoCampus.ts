import { prisma } from "@/server/db/prisma";

export interface TaxasFuncionamento {
  presencial: number;
  ead: number;
  eadMooc: number;
  eadFp: number;
  pisoPorCampus: number;
}

/**
 * As quatro taxas (R$ por matrícula, uma por modalidade) que a própria MDO publica
 * em `DADOS BASE!I29/I33/I37/I41`, já cadastradas em `CicloOrcamento`. Confirmado
 * batendo ao centésimo de centavo contra `DistribuicaoCampus` em 2027: dividindo
 * `vlMatrizPresencial` por `mtPresencial` de qualquer câmpus sem piso dá exatamente
 * `valorMatriculaPresencial` (R$ 1.201,47), e o mesmo vale para as outras três
 * modalidades. `null` quando o ciclo não tem essas taxas (2026, que saiu sem o valor
 * final por matrícula, ver `carregarProposta.ts`).
 */
export async function carregarTaxasFuncionamento(ano: number): Promise<TaxasFuncionamento | null> {
  const ciclo = await prisma.cicloOrcamento.findUnique({ where: { ano } });
  if (!ciclo || ciclo.valorMatriculaPresencial === null) return null;
  return {
    presencial: Number(ciclo.valorMatriculaPresencial),
    ead: Number(ciclo.valorMatriculaEad ?? 0),
    eadMooc: Number(ciclo.valorMatriculaEadMooc ?? 0),
    eadFp: Number(ciclo.valorMatriculaEadFp ?? 0),
    pisoPorCampus: Number(ciclo.pisoPorCampus),
  };
}

/**
 * Refaz o bloco Funcionamento (só ele: ~80% do total, não Qualidade e Eficiência,
 * Reitorias nem Assistência) de um câmpus a partir da matrícula equalizada por
 * modalidade (`DistribuicaoCampus.mtX`) e das taxas oficiais acima, aplicando o
 * Piso Mínimo por cima quando o câmpus é elegível (MAX, não soma, ver comentário de
 * `CicloOrcamento`). Existe só para conferência: comparar com `vlMatrFinal`
 * (a coluna "Gerado pela matriz" na Consulta é mais ampla, cobre todos os blocos).
 */
export function calcularFuncionamentoCampus(
  taxas: TaxasFuncionamento,
  campus: { mtPresencial: number; mtEad: number; mtEadMooc: number; mtEadFp: number; elegivelPiso: boolean },
): number {
  const calculado =
    campus.mtPresencial * taxas.presencial +
    campus.mtEad * taxas.ead +
    campus.mtEadMooc * taxas.eadMooc +
    campus.mtEadFp * taxas.eadFp;
  return campus.elegivelPiso ? Math.max(taxas.pisoPorCampus, calculado) : calculado;
}
