import { PESO_BLOCO_FUNCIONAMENTO } from "./constants/blocos.constants";

export interface FuncionamentoInput {
  campusId: number;
  matriculaPonderada: number;
}

export interface FuncionamentoResult {
  campusId: number;
  totalMatriculaPonderada: number;
  share: number;
  valorReais: number;
}

/**
 * Agrega a Matrícula Ponderada (MT_pond) por câmpus e distribui o Bloco de
 * Funcionamento (80% do saldo remanescente) proporcionalmente ao share de cada
 * câmpus no total da rede/instituto.
 */
export function blocoFuncionamento(
  inputs: FuncionamentoInput[],
  orcamentoTotal: number,
): FuncionamentoResult[] {
  if (inputs.length === 0) {
    return [];
  }

  const totaisPorCampus = new Map<number, number>();
  for (const input of inputs) {
    totaisPorCampus.set(
      input.campusId,
      (totaisPorCampus.get(input.campusId) ?? 0) + input.matriculaPonderada,
    );
  }

  const totalGeral = Array.from(totaisPorCampus.values()).reduce((total, v) => total + v, 0);
  const valorBloco = PESO_BLOCO_FUNCIONAMENTO * orcamentoTotal;

  return Array.from(totaisPorCampus.entries()).map(([campusId, totalMatriculaPonderada]) => {
    const share = totalGeral === 0 ? 0 : totalMatriculaPonderada / totalGeral;
    return {
      campusId,
      totalMatriculaPonderada,
      share,
      valorReais: share * valorBloco,
    };
  });
}
