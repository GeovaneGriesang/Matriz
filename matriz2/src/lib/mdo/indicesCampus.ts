/**
 * Índices de qualidade e eficiência de um câmpus, a partir da Conferência da Extração
 * da PNP (2ª fase). São os mesmos ingredientes do IEA que a MDO calcula por
 * instituição, aqui aplicados a cada câmpus para poder comparar câmpus de uma mesma
 * instituição.
 *
 * Os três desfechos de um aluno somam 100% (conferido na aba INDICADORES: no IFSul,
 * conclusão 39,6% + evasão 48,2% + retenção 12,2%):
 *   conclusão  concluídos e integralizados;
 *   evasão     abandono, desligamento, reprovação e transferências;
 *   retenção   retidos além do prazo.
 * E a eficiência acadêmica é conclusão / (conclusão + evasão): de quem teve um desfecho
 * final, que fração terminou. Reproduz o IFSul: 0,396 / (0,396 + 0,4821) = 0,451.
 */

export type ChaveIndice = "eficiencia" | "conclusao" | "menosEvasao" | "menosRetencao";

export const ROTULO_INDICE: Record<ChaveIndice, string> = {
  eficiencia: "Eficiência acadêmica",
  conclusao: "Taxa de conclusão",
  menosEvasao: "Menor evasão",
  menosRetencao: "Menor retenção",
};

export const EXPLICACAO_INDICE: Record<ChaveIndice, string> = {
  eficiencia: "Conclusão ÷ (conclusão + evasão): de quem teve um desfecho final, quantos terminaram. É o indicador que a MDO usa no IEA.",
  conclusao: "Concluídos e integralizados ÷ todos os desfechos (conclusão, evasão e retenção).",
  menosEvasao: "1 menos a taxa de evasão: premia quem perde menos alunos no caminho.",
  menosRetencao: "1 menos a taxa de retenção: premia quem não deixa aluno para trás além do prazo.",
};

export interface DesfechosCampus {
  concluido: number;
  integralizado: number;
  retido: number;
  abandono: number;
  desligado: number;
  reprovado: number;
  transfExterna: number;
  transfInterna: number;
}

export type IndicesCampus = Record<ChaveIndice, number>;

/** `null` quando o câmpus não tem nenhum desfecho registrado (sem base para o índice). */
export function indicesDoCampus(d: DesfechosCampus): IndicesCampus | null {
  const conclusao = d.concluido + d.integralizado;
  const evasao = d.abandono + d.desligado + d.reprovado + d.transfExterna + d.transfInterna;
  const retencao = d.retido;
  const total = conclusao + evasao + retencao;
  if (total <= 0) return null;
  return {
    eficiencia: conclusao + evasao > 0 ? conclusao / (conclusao + evasao) : 0,
    conclusao: conclusao / total,
    menosEvasao: 1 - evasao / total,
    menosRetencao: 1 - retencao / total,
  };
}
