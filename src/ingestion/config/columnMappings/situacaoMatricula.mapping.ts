import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDataBr, parseDecimalBr } from "../../parsing/transforms";

/**
 * SituacaoMatricula.csv — matrícula equivalente (Mateq) e datas de ciclo por matrícula.
 * TODO: verificar os nomes exatos de coluna contra um export real da PNP ou
 * a Portaria MEC 646/2022. Nomes abaixo são best-guess a partir do PRD.
 */
export interface SituacaoMatriculaRow {
  codigoCampus: string;
  codigoCurso: string;
  matriculaEquivalente: number;
  situacao: string;
  dataIngressoCiclo: Date;
  dataReferencia: Date;
}

export const situacaoMatriculaMapping: ColumnMapping<SituacaoMatriculaRow> = {
  fileType: "SITUACAO_MATRICULA",
  columns: {
    codigoCampus: {
      sourceHeaderCandidates: ["Codigo_Campus", "CO_CAMPUS", "Código do Câmpus"],
      required: true,
      transform: identity,
    },
    codigoCurso: {
      sourceHeaderCandidates: ["Codigo_Curso", "CO_CURSO", "Código do Curso"],
      required: true,
      transform: identity,
    },
    matriculaEquivalente: {
      sourceHeaderCandidates: ["Matricula_Equivalente", "QT_MATRICULA_EQUIVALENTE", "Mateq"],
      required: true,
      transform: parseDecimalBr,
    },
    situacao: {
      sourceHeaderCandidates: ["Situacao_Matricula", "TP_SITUACAO_MATRICULA", "Situação"],
      required: true,
      transform: identity,
    },
    dataIngressoCiclo: {
      sourceHeaderCandidates: ["Data_Ingresso_Ciclo", "DT_INGRESSO_CICLO", "Data de Ingresso no Ciclo"],
      required: true,
      transform: parseDataBr,
    },
    dataReferencia: {
      sourceHeaderCandidates: ["Data_Referencia", "DT_REFERENCIA", "Data de Referência"],
      required: true,
      transform: parseDataBr,
    },
  },
};
