import { IEA_BAND_WEIGHTS } from "../../constants/qualidadeEficiencia.constants";
import type { IeaBand } from "../../types/qualidadeEficiencia.types";

export function weightIea(band: IeaBand): number {
  const peso = IEA_BAND_WEIGHTS[band];
  if (peso === undefined) {
    throw new Error(`Faixa de IEA não reconhecida: "${band}"`);
  }
  return peso;
}
