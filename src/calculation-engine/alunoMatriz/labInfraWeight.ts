import { LAB_INFRA_WEIGHT_BY_TIER } from "../constants/alunoMatriz.constants";
import type { LabInfraTier } from "../types/alunoMatriz.types";

export function labInfraWeight(tier: LabInfraTier): number {
  const peso = LAB_INFRA_WEIGHT_BY_TIER[tier];
  if (peso === undefined) {
    throw new Error(`Tier de infraestrutura de laboratório não reconhecido: "${tier}"`);
  }
  return peso;
}
