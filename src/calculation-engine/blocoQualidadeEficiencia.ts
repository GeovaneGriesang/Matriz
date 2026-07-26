import {
  PESO_BLOCO_QUALIDADE_EFICIENCIA,
  PESO_IEA_SUBBLOCO,
  PESO_RAP_SUBBLOCO,
  PESO_IAPL_SUBBLOCO,
} from "./constants/blocos.constants";
import type { IeaInput, RapInput, IaplCampusInput } from "./types/qualidadeEficiencia.types";
import { calcularBlocoIea } from "./qualidadeEficiencia/iea/calcularBlocoIea";
import { calcularBlocoRap } from "./qualidadeEficiencia/rap/calcularBlocoRap";
import { calcularBlocoIapl } from "./qualidadeEficiencia/iapl/calcularBlocoIapl";

export interface QualidadeEficienciaInstituicaoResult {
  instituicaoId: number;
  valorIea: number;
  valorRap: number;
  valorIapl: number;
  valorTotal: number;
}

const SOMA_SUBBLOCOS = PESO_IEA_SUBBLOCO + PESO_RAP_SUBBLOCO + PESO_IAPL_SUBBLOCO;
if (Math.abs(SOMA_SUBBLOCOS - PESO_BLOCO_QUALIDADE_EFICIENCIA) > 1e-9) {
  throw new Error(
    "Inconsistência de constantes: PESO_IEA_SUBBLOCO + PESO_RAP_SUBBLOCO + PESO_IAPL_SUBBLOCO " +
      "deve ser igual a PESO_BLOCO_QUALIDADE_EFICIENCIA",
  );
}

/**
 * Compõe IEA (2,5%) + RAP (2,5%) + IAPL (5,0%) no Bloco de Qualidade e
 * Eficiência (10%) — resultado por INSTITUIÇÃO, não por câmpus (mesmo padrão
 * do Bloco Reitorias: a Matriz CONIF só apura esses sub-blocos em nível
 * institucional).
 */
export function blocoQualidadeEficiencia(
  ieaInputs: IeaInput[],
  rapInputs: RapInput[],
  iaplInputs: IaplCampusInput[],
  orcamentoTotal: number,
  overridesIeaPorInstituicao?: Map<number, number>,
  overridesRapPorInstituicao?: Map<number, number>,
): QualidadeEficienciaInstituicaoResult[] {
  const iea = calcularBlocoIea(ieaInputs, orcamentoTotal, overridesIeaPorInstituicao);
  const rap = calcularBlocoRap(rapInputs, orcamentoTotal, overridesRapPorInstituicao);
  const iapl = calcularBlocoIapl(iaplInputs, orcamentoTotal);

  const instituicaoIds = new Set<number>([
    ...iea.map((r) => r.instituicaoId),
    ...rap.map((r) => r.instituicaoId),
    ...iapl.map((r) => r.instituicaoId),
  ]);

  return Array.from(instituicaoIds).map((instituicaoId) => {
    const valorIea = iea.find((r) => r.instituicaoId === instituicaoId)?.valorReais ?? 0;
    const valorRap = rap.find((r) => r.instituicaoId === instituicaoId)?.valorReais ?? 0;
    const valorIapl = iapl.find((r) => r.instituicaoId === instituicaoId)?.valorTotal ?? 0;
    return {
      instituicaoId,
      valorIea,
      valorRap,
      valorIapl,
      valorTotal: valorIea + valorRap + valorIapl,
    };
  });
}
