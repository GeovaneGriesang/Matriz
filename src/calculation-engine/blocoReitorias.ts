import { PESO_BLOCO_REITORIAS } from "./constants/blocos.constants";

export interface ReitoriaResult {
  autarquiaId: number;
  valorReais: number;
}

/**
 * PLACEHOLDER: o PRD não especifica a fórmula oficial de distribuição do Bloco
 * de Reitorias (10%). Por decisão do usuário, usa um split igualitário entre
 * as autarquias do escopo informado — cada uma recebe `orcamentoTotal * 0.10 / N`,
 * onde N é a quantidade de autarquias do escopo (CONIF ou Todas, ver
 * `escopoInstituicoes.ts`). Substituir pela fórmula oficial assim que confirmada.
 */
export function blocoReitorias(autarquiaIds: number[], orcamentoTotal: number): ReitoriaResult[] {
  if (autarquiaIds.length === 0) {
    return [];
  }

  const valorBloco = PESO_BLOCO_REITORIAS * orcamentoTotal;
  const valorPorAutarquia = valorBloco / autarquiaIds.length;

  return autarquiaIds.map((autarquiaId) => ({
    autarquiaId,
    valorReais: valorPorAutarquia,
  }));
}
