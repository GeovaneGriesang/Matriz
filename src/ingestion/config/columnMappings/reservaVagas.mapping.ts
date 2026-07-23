import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** ReservaVagas.csv — vagas regulares por tipo de reserva, por câmpus. */
export interface ReservaVagasRow extends SharedDimensions {
  unidadeNome: string;
  tipoReservaVaga: string;
  vagasRegulares: number | null;
  vagasRegularesPercentual: number | null;
}

export const reservaVagasMapping: ColumnMapping<ReservaVagasRow> = {
  fileType: "RESERVA_VAGAS",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    tipoReservaVaga: {
      sourceHeaderCandidates: ["tipoReservaVaga"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    vagasRegulares: {
      sourceHeaderCandidates: ["Vagas Regulares"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Vagas Regulares",
    },
    vagasRegularesPercentual: {
      sourceHeaderCandidates: ["Vagas Regulares %"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Vagas Regulares %",
    },
  },
};
