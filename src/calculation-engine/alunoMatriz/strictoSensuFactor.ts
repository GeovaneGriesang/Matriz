import { FATOR_STRICTO_SENSU } from "../constants/alunoMatriz.constants";
import { NIVEIS_STRICTO_SENSU, type NivelCurso } from "../types/alunoMatriz.types";

export function isStrictoSensu(nivel: NivelCurso): boolean {
  return (NIVEIS_STRICTO_SENSU as readonly string[]).includes(nivel);
}

/** Retorna o fator Stricto Sensu (3.75) para mestrado/doutorado, ou 1 (no-op) para os demais níveis. */
export function strictoSensuFactor(nivel: NivelCurso): number {
  return isStrictoSensu(nivel) ? FATOR_STRICTO_SENSU : 1;
}
