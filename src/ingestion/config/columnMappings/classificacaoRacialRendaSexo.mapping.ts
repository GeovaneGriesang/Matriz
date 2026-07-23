import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/**
 * ClassificacaoRacialRendaSexo.csv — dados demográficos e de renda por
 * matrícula. Só por instituição (sem nomeUnidadeRecente no export real).
 */
export interface ClassificacaoRacialRendaSexoRow extends SharedDimensions {
  corRaca: string;
  rendaFamiliar: string;
  faixaEtaria: string;
  sexo: string;
  numeroConcluintes: number | null;
  numeroIngressantes: number | null;
  numeroMatriculas: number | null;
  numeroVagas: number | null;
}

export const classificacaoRacialRendaSexoMapping: ColumnMapping<ClassificacaoRacialRendaSexoRow> = {
  fileType: "CLASSIFICACAO_RACIAL_RENDA_SEXO",
  columns: {
    ...sharedDimensionColumns(),
    corRaca: {
      sourceHeaderCandidates: ["CorRaca"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    rendaFamiliar: {
      sourceHeaderCandidates: ["RendaFamiliar"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    faixaEtaria: {
      sourceHeaderCandidates: ["FaixaEtaria"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    sexo: {
      sourceHeaderCandidates: ["Sexo"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    numeroConcluintes: {
      sourceHeaderCandidates: ["Número de concluintes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de concluintes",
    },
    numeroIngressantes: {
      sourceHeaderCandidates: ["Número de ingressantes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de ingressantes",
    },
    numeroMatriculas: {
      sourceHeaderCandidates: ["Número de Matrículas"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de Matrículas",
    },
    numeroVagas: {
      sourceHeaderCandidates: ["Número de vagas"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de vagas",
    },
  },
};
