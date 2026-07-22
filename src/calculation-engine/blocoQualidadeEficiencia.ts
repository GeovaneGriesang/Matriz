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

export interface QualidadeEficienciaCampusResult {
  campusId: number;
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

/** Compõe IEA (2,5%) + RAP (2,5%) + IAPL (5,0%) no Bloco de Qualidade e Eficiência (10%). */
export function blocoQualidadeEficiencia(
  ieaInputs: IeaInput[],
  rapInputs: RapInput[],
  iaplInputs: IaplCampusInput[],
  orcamentoTotal: number,
): QualidadeEficienciaCampusResult[] {
  const iea = calcularBlocoIea(ieaInputs, orcamentoTotal);
  const rap = calcularBlocoRap(rapInputs, orcamentoTotal);
  const iapl = calcularBlocoIapl(iaplInputs, orcamentoTotal);

  const campusIds = new Set<number>([
    ...iea.map((r) => r.campusId),
    ...rap.map((r) => r.campusId),
    ...iapl.map((r) => r.campusId),
  ]);

  return Array.from(campusIds).map((campusId) => {
    const valorIea = iea.find((r) => r.campusId === campusId)?.valorReais ?? 0;
    const valorRap = rap.find((r) => r.campusId === campusId)?.valorReais ?? 0;
    const valorIapl = iapl.find((r) => r.campusId === campusId)?.valorTotal ?? 0;
    return {
      campusId,
      valorIea,
      valorRap,
      valorIapl,
      valorTotal: valorIea + valorRap + valorIapl,
    };
  });
}
