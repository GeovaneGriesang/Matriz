import { PESO_BLOCO_REITORIAS } from "./constants/blocos.constants";

export interface ReitoriaInput {
  instituicaoId: number;
  matriculaPonderada: number;
}

export interface ReitoriaResult {
  autarquiaId: number;
  totalMatriculaPonderada: number;
  share: number;
  valorReais: number;
}

/**
 * Distribui o Bloco de Reitorias (10%) proporcionalmente à Matrícula Ponderada de
 * cada instituição — a mesma base usada no Bloco Funcionamento (blocoFuncionamento.ts),
 * agregada por instituição em vez de por câmpus. Portaria MEC nº 646/2022, Art. 3º,
 * II ("Reitoria/Direção-Geral: [...] tendo a mesma base aplicada no bloco
 * Funcionamento") e Anexo ("nos blocos 'Reitoria' e 'Qualidade e Eficiência', a
 * distribuição orçamentária ocorrerá no nível das Instituições").
 */
export function blocoReitorias(inputs: ReitoriaInput[], orcamentoTotal: number): ReitoriaResult[] {
  if (inputs.length === 0) {
    return [];
  }

  const totaisPorInstituicao = new Map<number, number>();
  for (const input of inputs) {
    totaisPorInstituicao.set(
      input.instituicaoId,
      (totaisPorInstituicao.get(input.instituicaoId) ?? 0) + input.matriculaPonderada,
    );
  }

  const totalGeral = Array.from(totaisPorInstituicao.values()).reduce((total, v) => total + v, 0);
  const valorBloco = PESO_BLOCO_REITORIAS * orcamentoTotal;

  return Array.from(totaisPorInstituicao.entries()).map(([autarquiaId, totalMatriculaPonderada]) => {
    const share = totalGeral === 0 ? 0 : totalMatriculaPonderada / totalGeral;
    return {
      autarquiaId,
      totalMatriculaPonderada,
      share,
      valorReais: share * valorBloco,
    };
  });
}
