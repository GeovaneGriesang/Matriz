import {
  JANELA_RETENCAO_DIAS,
  PESO_RETENCAO_DENTRO_JANELA,
  PESO_RETENCAO_FORA_JANELA,
} from "../constants/alunoMatriz.constants";

const MS_POR_DIA = 1000 * 60 * 60 * 24;

export interface JanelaRetencaoResult {
  diasNoCiclo: number;
  dentroDaJanela: boolean;
}

/** Calcula a posição da matrícula em relação à janela atemporal de retenção (≤ 1095 dias). */
export function retencaoJanela(dataIngressoCiclo: Date, dataReferencia: Date): JanelaRetencaoResult {
  const diasNoCiclo = Math.round(
    (dataReferencia.getTime() - dataIngressoCiclo.getTime()) / MS_POR_DIA,
  );
  return {
    diasNoCiclo,
    dentroDaJanela: diasNoCiclo <= JANELA_RETENCAO_DIAS,
  };
}

/** Peso multiplicador de retenção a partir do resultado de `retencaoJanela`. */
export function pesoRetencao(dentroDaJanela: boolean): number {
  return dentroDaJanela ? PESO_RETENCAO_DENTRO_JANELA : PESO_RETENCAO_FORA_JANELA;
}
