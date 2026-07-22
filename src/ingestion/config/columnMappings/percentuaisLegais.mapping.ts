import type { ColumnMapping } from "../mappingTypes";
import { identity, parseInteiro } from "../../parsing/transforms";

/**
 * PercentuaisLegais.csv — matrículas por meta legal do IAPL (Técnicos/Formação de
 * Professores/PROEJA), por câmpus/ano.
 * TODO: verificar os nomes exatos de coluna contra um export real da PNP ou
 * a Portaria MEC 646/2022. Nomes abaixo são best-guess a partir do PRD.
 */
export interface PercentuaisLegaisRow {
  codigoCampus: string;
  matriculasTecnicos: number;
  matriculasFormacaoProfessores: number;
  matriculasProeja: number;
  referenciaAno: number;
}

export const percentuaisLegaisMapping: ColumnMapping<PercentuaisLegaisRow> = {
  fileType: "PERCENTUAIS_LEGAIS",
  columns: {
    codigoCampus: {
      sourceHeaderCandidates: ["Codigo_Campus", "CO_CAMPUS", "Código do Câmpus"],
      required: true,
      transform: identity,
    },
    matriculasTecnicos: {
      sourceHeaderCandidates: ["Matriculas_Tecnicos", "QT_MATRICULA_TECNICO", "Matrículas Técnicos"],
      required: true,
      transform: parseInteiro,
    },
    matriculasFormacaoProfessores: {
      sourceHeaderCandidates: [
        "Matriculas_Formacao_Professores",
        "QT_MATRICULA_FORMACAO_PROF",
        "Matrículas Formação de Professores",
      ],
      required: true,
      transform: parseInteiro,
    },
    matriculasProeja: {
      sourceHeaderCandidates: ["Matriculas_Proeja", "QT_MATRICULA_PROEJA", "Matrículas PROEJA"],
      required: true,
      transform: parseInteiro,
    },
    referenciaAno: {
      sourceHeaderCandidates: ["Ano", "ANO_REFERENCIA", "Ano_Referencia"],
      required: true,
      transform: parseInteiro,
    },
  },
};
