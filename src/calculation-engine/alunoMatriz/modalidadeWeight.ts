import { MODALIDADE_WEIGHTS } from "../constants/alunoMatriz.constants";
import type { ModalidadeEnsino } from "../types/alunoMatriz.types";

export function modalidadeWeight(modalidade: ModalidadeEnsino): number {
  const peso = MODALIDADE_WEIGHTS[modalidade];
  if (peso === undefined) {
    throw new Error(`Modalidade de ensino não reconhecida: "${modalidade}"`);
  }
  return peso;
}
