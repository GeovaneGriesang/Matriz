import { PESO_BLOCO_REITORIAS } from "./constants/blocos.constants";

export interface ReitoriaResult {
  autarquiaId: number;
  valorReais: number;
}

/**
 * Bloco de Reitorias (10% da Ação 20RL): destinado ao funcionamento
 * administrativo e sistêmico centralizado da própria Reitoria. `orcamentoTotal`
 * já é o valor do Custeio (20RL) da autarquia informada — não da Rede Federal
 * inteira — então não há divisão entre outras instituições.
 */
export function blocoReitorias(autarquiaId: number, orcamentoTotal: number): ReitoriaResult {
  return {
    autarquiaId,
    valorReais: PESO_BLOCO_REITORIAS * orcamentoTotal,
  };
}
