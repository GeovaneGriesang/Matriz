import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** SituacaoMatricula.csv — número de matrículas por situação, por câmpus. */
export interface SituacaoMatriculaRow extends SharedDimensions {
  unidadeNome: string;
  categoriaSituacao: string;
  nomeSituacao: string;
  fluxoRetido: string;
  numeroMatriculas: number | null;
}

export const situacaoMatriculaMapping: ColumnMapping<SituacaoMatriculaRow> = {
  fileType: "SITUACAO_MATRICULA",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    categoriaSituacao: {
      sourceHeaderCandidates: ["categoriaSituacao"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    nomeSituacao: {
      sourceHeaderCandidates: ["nomeSituacao"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    fluxoRetido: {
      sourceHeaderCandidates: ["FluxoRetido"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    numeroMatriculas: {
      sourceHeaderCandidates: ["Número de Matrículas"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de Matrículas",
    },
  },
};
