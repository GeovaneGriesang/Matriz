import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/** TecnicosAdmNivel.csv — número de técnicos administrativos por titulação, por instituição. */
export interface TecnicosAdmNivelRow extends SharedDimensions {
  titulacao: string;
  numeroTae: number | null;
}

export const tecnicosAdmNivelMapping: ColumnMapping<TecnicosAdmNivelRow> = {
  fileType: "TECNICOS_ADM_NIVEL",
  columns: {
    ...sharedDimensionColumns(),
    // Confirmado no export nacional real: algumas linhas de TAE não têm titulação
    // registrada (célula vazia) — é um valor legítimo da PNP, não dado ausente/quebrado.
    titulacao: {
      sourceHeaderCandidates: ["Titulação"],
      required: true,
      allowEmptyValue: true,
      transform: identity,
      kind: "dimension",
    },
    numeroTae: {
      sourceHeaderCandidates: ["Servidores | Número de TAE"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Servidores | Número de TAE",
    },
  },
};
