import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/** TitulacaoDocente.csv — Índice de Titulação do Corpo Docente (ITCD) e contagens, por instituição. */
export interface TitulacaoDocenteRow extends SharedDimensions {
  docenteEfetivo: number | null;
  numeroDocentes: number | null;
  numeroServidores: number | null;
  itcd: number | null;
}

export const titulacaoDocenteMapping: ColumnMapping<TitulacaoDocenteRow> = {
  fileType: "TITULACAO_DOCENTE",
  columns: {
    ...sharedDimensionColumns(),
    docenteEfetivo: {
      sourceHeaderCandidates: ["Servidores | Docente Efetivo"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Servidores | Docente Efetivo",
    },
    numeroDocentes: {
      sourceHeaderCandidates: ["Servidores | Número de Docentes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Servidores | Número de Docentes",
    },
    numeroServidores: {
      sourceHeaderCandidates: ["Servidores | Número de Servidores"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Servidores | Número de Servidores",
    },
    itcd: {
      sourceHeaderCandidates: ["Servidores | ITCD"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Servidores | ITCD",
    },
  },
};
