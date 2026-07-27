import { PESO_BLOCO_FUNCIONAMENTO } from "./constants/blocos.constants";

export interface FuncionamentoInput {
  campusId: number;
  /** Participa do denominador que define a Taxa (MTP) — ver `matriculaMoocAdicional` abaixo. */
  matriculaPonderada: number;
  /**
   * Pago à MESMA Taxa (MTP) calculada a partir de `matriculaPonderada`, mas somado DEPOIS —
   * dinheiro adicional que não dilui a MTP dos demais câmpus (ver EAD MOOC em
   * `matriculaTotalEqualizada.ts`). Padrão 0 quando omitido (câmpus sem EAD MOOC, ou fonte
   * placeholder sem quebra de modalidade disponível).
   */
  matriculaMoocAdicional?: number;
}

export interface FuncionamentoResult {
  campusId: number;
  totalMatriculaPonderada: number;
  share: number;
  /** Taxa (MTP): R$ por ponto ponderado — valorBloco / totalGeral (mesma para toda a rede). */
  mtp: number;
  /** `matriculaMoocAdicional` agregado × MTP — parcela de `valorReais` que não participou do share. */
  valorMoocAdicional: number;
  valorReais: number;
}

/**
 * Agrega a Matrícula Ponderada (MT_pond) por câmpus e distribui o Bloco de
 * Funcionamento (80% do saldo remanescente) proporcionalmente ao share de cada
 * câmpus no total da rede/instituto, à Taxa (MTP) resultante — mais o adicional de EAD MOOC
 * (mesma MTP, somado depois de calculada, sem diluir a taxa dos demais câmpus).
 */
export function blocoFuncionamento(
  inputs: FuncionamentoInput[],
  orcamentoTotal: number,
): FuncionamentoResult[] {
  if (inputs.length === 0) {
    return [];
  }

  const totaisPorCampus = new Map<number, number>();
  const moocPorCampus = new Map<number, number>();
  for (const input of inputs) {
    totaisPorCampus.set(
      input.campusId,
      (totaisPorCampus.get(input.campusId) ?? 0) + input.matriculaPonderada,
    );
    moocPorCampus.set(
      input.campusId,
      (moocPorCampus.get(input.campusId) ?? 0) + (input.matriculaMoocAdicional ?? 0),
    );
  }

  const totalGeral = Array.from(totaisPorCampus.values()).reduce((total, v) => total + v, 0);
  const valorBloco = PESO_BLOCO_FUNCIONAMENTO * orcamentoTotal;
  const mtp = totalGeral === 0 ? 0 : valorBloco / totalGeral;

  return Array.from(totaisPorCampus.entries()).map(([campusId, totalMatriculaPonderada]) => {
    const share = totalGeral === 0 ? 0 : totalMatriculaPonderada / totalGeral;
    const valorMoocAdicional = (moocPorCampus.get(campusId) ?? 0) * mtp;
    return {
      campusId,
      totalMatriculaPonderada,
      share,
      mtp,
      valorMoocAdicional,
      valorReais: share * valorBloco + valorMoocAdicional,
    };
  });
}
