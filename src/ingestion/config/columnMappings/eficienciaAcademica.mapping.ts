import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBr, parseInteiro } from "../../parsing/transforms";

/**
 * EficienciaAcademica.csv — valor do IEA por câmpus/ano.
 * TODO: verificar os nomes exatos de coluna contra um export real da PNP ou
 * a Portaria MEC 646/2022. Nomes abaixo são best-guess a partir do PRD.
 */
export interface EficienciaAcademicaRow {
  codigoCampus: string;
  valorIea: number;
  referenciaAno: number;
}

export const eficienciaAcademicaMapping: ColumnMapping<EficienciaAcademicaRow> = {
  fileType: "EFICIENCIA_ACADEMICA",
  columns: {
    codigoCampus: {
      sourceHeaderCandidates: ["Codigo_Campus", "CO_CAMPUS", "Código do Câmpus"],
      required: true,
      transform: identity,
    },
    valorIea: {
      sourceHeaderCandidates: ["IEA", "Indice_Eficiencia_Academica", "Valor_IEA"],
      required: true,
      transform: parseDecimalBr,
    },
    referenciaAno: {
      sourceHeaderCandidates: ["Ano", "ANO_REFERENCIA", "Ano_Referencia"],
      required: true,
      transform: parseInteiro,
    },
  },
};
