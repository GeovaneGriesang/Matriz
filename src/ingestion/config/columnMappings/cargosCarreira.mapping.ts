import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/** CargosCarreira.csv — número de servidores por carreira (SIAFI), por instituição. */
export interface CargosCarreiraRow extends SharedDimensions {
  carreiraSigla: string;
  numeroServidoresSiafi: number | null;
}

export const cargosCarreiraMapping: ColumnMapping<CargosCarreiraRow> = {
  fileType: "CARGOS_CARREIRA",
  columns: {
    ...sharedDimensionColumns(),
    carreiraSigla: {
      sourceHeaderCandidates: ["CarreiraSigla"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    numeroServidoresSiafi: {
      sourceHeaderCandidates: ["Número de servidores (Siafi)"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de servidores (Siafi)",
    },
  },
};
