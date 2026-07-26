/**
 * Uma linha (instituição, faixa de RFP) com o número de matrículas naquela faixa — dado só
 * existe por instituição, não por câmpus.
 *
 * NÃO VALIDADO CONTRA A PLANILHA OFICIAL: `faixaRfp` vem de `ClassificacaoRacialRendaSexo.csv`
 * (dimensão "RendaFamiliar") — os rótulos batem exatamente com as faixas oficiais, mas o valor
 * final (VR) nunca foi comparado com a planilha/CONIF-SETEC. Ver blocoAssistenciaEstudantil.ts.
 */
export interface AssistenciaEstudantilRfpInput {
  instituicaoId: number;
  faixaRfp: string;
  numeroMatriculas: number;
}

/**
 * Matrícula Ponderada de um câmpus, separada por modalidade de ensino — a
 * Matriz CONIF pondera MECHDA como Presencial (peso cheio) + EAD/4 (um quarto
 * do peso), então precisamos das duas parcelas separadas para o MECHDA
 * institucional (usado no passo 2). A subdivisão do valor da instituição entre
 * seus câmpus (passo 3) usa a soma das duas (mesma base "matrícula ponderada
 * total" de sempre — essa etapa continua uma aproximação, ver types acima).
 */
export interface AssistenciaEstudantilCampusInput {
  campusId: number;
  instituicaoId: number;
  matriculaPonderadaPresencial: number;
  matriculaPonderadaEad: number;
}

export interface AssistenciaEstudantilCampusResultado {
  campusId: number;
  instituicaoId: number;
  /** VR (RF Ponderada): Σ (% de matrículas na faixa × peso da faixa) — índice de vulnerabilidade, 0 a 2,5. */
  vrInstituicao: number;
  /** MECHDA institucional = Σ Matrícula Ponderada Presencial + (Σ Matrícula Ponderada EAD ÷ 4). */
  mechdaInstituicao: number;
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
