/** Uma linha (instituição, faixa de RFP) com o número de matrículas naquela faixa — dado só existe por instituição, não por câmpus. */
export interface AssistenciaEstudantilRfpInput {
  instituicaoId: number;
  faixaRfp: string;
  numeroMatriculas: number;
}

/** Matrícula Ponderada de um câmpus — mesma base do Bloco Funcionamento, usada para subdividir o valor da instituição entre seus câmpus. */
export interface AssistenciaEstudantilCampusInput {
  campusId: number;
  instituicaoId: number;
  matriculaPonderada: number;
}

export interface AssistenciaEstudantilCampusResultado {
  campusId: number;
  instituicaoId: number;
  /** VR (RF Ponderada): Σ (% de matrículas na faixa × peso da faixa) — índice de vulnerabilidade, 0 a 2,5. */
  vrInstituicao: number;
  /** MECHDA × VR — só aqui o porte da instituição (Matrícula Ponderada) entra na fórmula. */
  participacaoPonderadaInstituicao: number;
  somaParticipacoesRede: number;
  shareInstituicao: number;
  valorInstituicao: number;
  matriculaPonderadaCampus: number;
  matriculaPonderadaInstituicao: number;
  shareDentroInstituicao: number;
  valorReais: number;
}
