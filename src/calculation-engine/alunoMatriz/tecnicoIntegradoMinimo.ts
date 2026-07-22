import { PESO_MINIMO_TECNICO_INTEGRADO } from "../constants/alunoMatriz.constants";
import type { NivelCurso } from "../types/alunoMatriz.types";

/** Aplica o piso de peso mínimo apenas a cursos Técnicos Integrados. */
export function tecnicoIntegradoMinimo(nivel: NivelCurso, pesoComputado: number): number {
  if (nivel !== "TECNICO_INTEGRADO") {
    return pesoComputado;
  }
  return Math.max(pesoComputado, PESO_MINIMO_TECNICO_INTEGRADO);
}
