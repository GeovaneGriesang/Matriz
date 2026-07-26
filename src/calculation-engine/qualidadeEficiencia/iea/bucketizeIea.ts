import {
  ESTRATEGIA_FAIXAS_IEA_PADRAO,
  IEA_BAND_THRESHOLDS_POR_ESTRATEGIA,
} from "../../constants/qualidadeEficiencia.constants";
import type { EstrategiaFaixasIea, IeaBand } from "../../types/qualidadeEficiencia.types";

/** Enquadra um valor de IEA na faixa normativa correspondente (limites inclusivos) da tabela da estratégia escolhida. */
export function bucketizeIea(
  valorIea: number,
  estrategia: EstrategiaFaixasIea = ESTRATEGIA_FAIXAS_IEA_PADRAO,
): IeaBand {
  const faixas = IEA_BAND_THRESHOLDS_POR_ESTRATEGIA[estrategia];
  const faixa = faixas.find((t) => valorIea <= t.max);
  if (!faixa) {
    throw new Error(`Não foi possível enquadrar o valor de IEA "${valorIea}" em nenhuma faixa (estratégia "${estrategia}")`);
  }
  return faixa.band;
}
