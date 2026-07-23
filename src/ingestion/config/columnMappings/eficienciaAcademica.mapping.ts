import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/**
 * EficienciaAcademica.csv — Índice de Eficiência Acadêmica (IEA) e
 * indicadores relacionados, por câmpus/ano. `indiceEficienciaAcademicaPercentual`
 * alimenta o Bloco de Qualidade e Eficiência (vem em escala 0-100%).
 */
export interface EficienciaAcademicaRow extends SharedDimensions {
  unidadeNome: string;
  concluidos: number | null;
  concluidosPercentual: number | null;
  indiceEficienciaAcademicaPercentual: number | null;
  numeroEvadidos: number | null;
  retidos: number | null;
  retidosPercentual: number | null;
  taxaEvasaoPercentual: number | null;
}

export const eficienciaAcademicaMapping: ColumnMapping<EficienciaAcademicaRow> = {
  fileType: "EFICIENCIA_ACADEMICA",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    concluidos: {
      sourceHeaderCandidates: ["Eficiência Acadêmica | Concluídos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Eficiência Acadêmica | Concluídos",
    },
    concluidosPercentual: {
      sourceHeaderCandidates: ["Eficiência Acadêmica | Concluídos %"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Eficiência Acadêmica | Concluídos %",
    },
    indiceEficienciaAcademicaPercentual: {
      sourceHeaderCandidates: ["Eficiência Acadêmica | Índice de Eficiência Acadêmica %"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Eficiência Acadêmica | Índice de Eficiência Acadêmica %",
    },
    numeroEvadidos: {
      sourceHeaderCandidates: ["Eficiência Acadêmica | Número de Evadidos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Eficiência Acadêmica | Número de Evadidos",
    },
    retidos: {
      sourceHeaderCandidates: ["Eficiência Acadêmica | Retidos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Eficiência Acadêmica | Retidos",
    },
    retidosPercentual: {
      sourceHeaderCandidates: ["Eficiência Acadêmica | Retidos %"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Eficiência Acadêmica | Retidos %",
    },
    taxaEvasaoPercentual: {
      sourceHeaderCandidates: ["Eficiência Acadêmica | Taxa de Evasão %"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Eficiência Acadêmica | Taxa de Evasão %",
    },
  },
};
