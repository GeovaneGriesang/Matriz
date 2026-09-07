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

/** O bloco Funcionamento de um câmpus antes do Piso Mínimo entrar, pela matrícula
 * equalizada por modalidade × as taxas oficiais. É este valor, não o final com piso,
 * que a perda por evasão de fato altera: evasão muda matrícula, e matrícula só
 * afeta o Funcionamento por esta conta, antes do piso substituir o resultado. */
function funcionamentoAntesDoPiso(
  taxas: TaxasFuncionamento,
  campus: { mtPresencial: number; mtEad: number; mtEadMooc: number; mtEadFp: number },
): number {
  return (
    campus.mtPresencial * taxas.presencial +
    campus.mtEad * taxas.ead +
    campus.mtEadMooc * taxas.eadMooc +
    campus.mtEadFp * taxas.eadFp
  );
}

/**
 * Refaz o bloco Funcionamento (só ele: ~80% do total, não Qualidade e Eficiência,
 * Reitorias nem Assistência) de um câmpus a partir da matrícula equalizada por
 * modalidade (`DistribuicaoCampus.mtX`) e das taxas oficiais acima, aplicando o
 * Piso Mínimo por cima quando o câmpus é elegível (MAX, não soma, ver comentário de
 * `CicloOrcamento`). Existe para conferência: comparar com `vlMatrFinal`, o mesmo
 * valor que "Gerado pela matriz" mostra na Consulta (Funcionamento apenas, não o
 * total dos quatro blocos).
 */
export function calcularFuncionamentoCampus(
  taxas: TaxasFuncionamento,
  campus: { mtPresencial: number; mtEad: number; mtEadMooc: number; mtEadFp: number; elegivelPiso: boolean },
): number {
  const calculado = funcionamentoAntesDoPiso(taxas, campus);
  return campus.elegivelPiso ? Math.max(taxas.pisoPorCampus, calculado) : calculado;
}

/**
 * Verdadeiro quando o câmpus já está travado no Piso Mínimo: elegível, e o cálculo
 * por matrícula dá menos que o piso. Serve para avisar em Evasão e no Simulador que
 * reduzir a evasão desse câmpus pode não aumentar nada o valor recebido, porque o
 * Funcionamento dele já está no piso, não no calculado por matrícula.
 */
export function campusEstaNoPiso(
  taxas: TaxasFuncionamento,
  campus: { mtPresencial: number; mtEad: number; mtEadMooc: number; mtEadFp: number; elegivelPiso: boolean },
): boolean {
  return campus.elegivelPiso && funcionamentoAntesDoPiso(taxas, campus) < taxas.pisoPorCampus;
}
