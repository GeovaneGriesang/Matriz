import { RAP_BAND_THRESHOLDS, RAP_BAND_WEIGHTS } from "../../constants/qualidadeEficiencia.constants";
import type { RapBand } from "../../types/qualidadeEficiencia.types";

/** Enquadra a razão docente/aluno na faixa normativa correspondente (limites inclusivos). */
export function bucketizeRap(razaoDocenteAluno: number): RapBand {
  const faixa = RAP_BAND_THRESHOLDS.find((t) => razaoDocenteAluno <= t.max);
  if (!faixa) {
    throw new Error(
      `Não foi possível enquadrar a razão docente/aluno "${razaoDocenteAluno}" em nenhuma faixa`,
    );
  }
  return faixa.band;
}

export function weightRap(band: RapBand): number {
  const peso = RAP_BAND_WEIGHTS[band];
  if (peso === undefined) {
    throw new Error(`Faixa de RAP não reconhecida: "${band}"`);
  }
  return peso;
}
