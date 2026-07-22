export type ModalidadeEnsino = "PRESENCIAL" | "EAD_PROPRIO" | "EAD_FOMENTO_EXTERNO";

export type NivelCurso =
  | "TECNICO_INTEGRADO"
  | "TECNICO_CONCOMITANTE"
  | "TECNICO_SUBSEQUENTE"
  | "GRADUACAO"
  | "ESPECIALIZACAO"
  | "MESTRADO"
  | "DOUTORADO";

export const NIVEIS_STRICTO_SENSU: readonly NivelCurso[] = ["MESTRADO", "DOUTORADO"];

export type LabInfraTier = 1 | 2 | 3 | 4;

export interface MatriculaPonderadaInput {
  matriculaEquivalente: number;
  modalidade: ModalidadeEnsino;
  nivel: NivelCurso;
  eixoAgricola: boolean;
  labInfraTier: LabInfraTier;
  /** Data de ingresso no ciclo regular da matrícula, para a janela de retenção. */
  dataIngressoCiclo: Date;
  /** Data de referência do cálculo (normalmente a data-base do extrato PNP). */
  dataReferencia: Date;
}

export interface MatriculaPonderadaResult {
  matriculaPonderada: number;
  strictoSensuAplicado: boolean;
  dentroDaJanelaRetencao: boolean;
}
