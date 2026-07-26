import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptionalEscala100 } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/**
 * PercentuaisLegais.csv — Matrícula Equivalente por meta legal, por câmpus.
 * Os 4 valores de Matrícula Equivalente (Geral/Técnicos/Formação de Professores/Proeja) vêm 100x
 * maiores que o valor real neste export da PNP — corrigido na leitura via
 * `parseDecimalBrOptionalEscala100` (ver Achado 6 de docs/pnp-matriz/Comparacao_CSV_vs_Matriz_5aFase.md).
 */
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
      transform: parseDecimalBrOptionalEscala100,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Formação de Professores",
    },
    mateqTecnicos: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Técnicos"],
      required: true,
      transform: parseDecimalBrOptionalEscala100,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Técnicos",
    },
    mateqProeja: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Proeja"],
      required: true,
      transform: parseDecimalBrOptionalEscala100,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Proeja",
    },
    mateqGeral: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Geral"],
      required: true,
      transform: parseDecimalBrOptionalEscala100,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Geral",
    },
  },
};
