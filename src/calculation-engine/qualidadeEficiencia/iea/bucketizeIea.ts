import { IEA_BAND_THRESHOLDS } from "../../constants/qualidadeEficiencia.constants";
import type { IeaBand } from "../../types/qualidadeEficiencia.types";

/** Enquadra um valor de IEA na faixa normativa correspondente (limites inclusivos). */
export function bucketizeIea(valorIea: number): IeaBand {
  const faixa = IEA_BAND_THRESHOLDS.find((t) => valorIea <= t.max);
  if (!faixa) {
    throw new Error(`Não foi possível enquadrar o valor de IEA "${valorIea}" em nenhuma faixa`);
  }
  return faixa.band;
}
