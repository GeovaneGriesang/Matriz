import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** TaxaEvasao.csv — matrículas e evasão por curso (grão mais fino: até turno/financiamento). */
export interface TaxaEvasaoRow extends SharedDimensions {
  unidadeNome: string;
  nomeCurso: string;
  tipoCurso: string;
  tipoEixoTecnologico: string;
  subeixoTecnologico: string;
  tipoOferta: string;
  turnoCurso: string;
  modalidadeEnsino: string;
  nomeFonteFinanciamento: string;
  numeroMatriculas: number | null;
  numeroEvadidos: number | null;
  taxaEvasaoPercentual: number | null;
}

export const taxaEvasaoMapping: ColumnMapping<TaxaEvasaoRow> = {
  fileType: "TAXA_EVASAO",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    nomeCurso: {
      sourceHeaderCandidates: ["nomeCurso"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    tipoCurso: {
      sourceHeaderCandidates: ["tipoCurso"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    tipoEixoTecnologico: {
      sourceHeaderCandidates: ["tipoEixoTecnologico"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    subeixoTecnologico: {
      sourceHeaderCandidates: ["SubeixoTecnologico"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    tipoOferta: {
      sourceHeaderCandidates: ["tipoOferta"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    turnoCurso: {
      sourceHeaderCandidates: ["turnoCurso"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    modalidadeEnsino: {
      sourceHeaderCandidates: ["ModalidadeEnsino"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    nomeFonteFinanciamento: {
      sourceHeaderCandidates: ["nomeFonteFinanciamento"],
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
    numeroEvadidos: {
      sourceHeaderCandidates: ["Matrículas | Número de Evadidos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Matrículas | Número de Evadidos",
    },
    taxaEvasaoPercentual: {
      sourceHeaderCandidates: ["Matrículas | Taxa de Evasão %"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Matrículas | Taxa de Evasão %",
    },
  },
};
