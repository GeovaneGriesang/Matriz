import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** RelacaoInscritosVagas.csv — relação candidato/vaga, por câmpus. */
export interface RelacaoInscritosVagasRow extends SharedDimensions {
  unidadeNome: string;
  numeroInscritos: number | null;
  numeroVagas: number | null;
  relacaoInscritoVaga: number | null;
}

export const relacaoInscritosVagasMapping: ColumnMapping<RelacaoInscritosVagasRow> = {
  fileType: "RELACAO_INSCRITOS_VAGAS",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    numeroInscritos: {
      sourceHeaderCandidates: ["Número de inscritos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de inscritos",
    },
    numeroVagas: {
      sourceHeaderCandidates: ["Número de vagas"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de vagas",
    },
    relacaoInscritoVaga: {
      sourceHeaderCandidates: ["Relação Inscrito Vaga"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Relação Inscrito Vaga",
    },
  },
};
