import {
  ESTRATEGIA_FAIXAS_IEA_PADRAO,
  IEA_BAND_WEIGHTS_POR_ESTRATEGIA,
} from "../../constants/qualidadeEficiencia.constants";
import type { EstrategiaFaixasIea, IeaBand } from "../../types/qualidadeEficiencia.types";

export function weightIea(band: IeaBand, estrategia: EstrategiaFaixasIea = ESTRATEGIA_FAIXAS_IEA_PADRAO): number {
  const peso = IEA_BAND_WEIGHTS_POR_ESTRATEGIA[estrategia][band];
  if (peso === undefined) {
    throw new Error(`Faixa de IEA não reconhecida: "${band}" (estratégia "${estrategia}")`);
  }
  return peso;
}
