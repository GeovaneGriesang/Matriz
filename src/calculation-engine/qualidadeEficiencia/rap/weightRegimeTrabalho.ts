import { REGIME_TRABALHO_WEIGHTS } from "../../constants/qualidadeEficiencia.constants";
import type { RegimeTrabalho } from "../../types/qualidadeEficiencia.types";

export function weightRegimeTrabalho(regime: RegimeTrabalho): number {
  const peso = REGIME_TRABALHO_WEIGHTS[regime];
  if (peso === undefined) {
    throw new Error(`Regime de trabalho não reconhecido: "${regime}"`);
  }
  return peso;
}
