import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** PercentuaisLegais.csv — Matrícula Equivalente por meta legal, por câmpus. */
export interface PercentuaisLegaisRow extends SharedDimensions {
  unidadeNome: string;
  mateqFormacaoProfessores: number | null;
  mateqTecnicos: number | null;
  mateqProeja: number | null;
  mateqGeral: number | null;
}

export const percentuaisLegaisMapping: ColumnMapping<PercentuaisLegaisRow> = {
  fileType: "PERCENTUAIS_LEGAIS",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    mateqFormacaoProfessores: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Formação de Professores"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Formação de Professores",
    },
    mateqTecnicos: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Técnicos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Técnicos",
    },
    mateqProeja: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Proeja"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Proeja",
    },
    mateqGeral: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Geral"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Geral",
    },
  },
};
