import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** OfertaVagasNoturnas.csv — oferta de vagas em curso noturno/graduação, por câmpus. */
export interface OfertaVagasNoturnasRow extends SharedDimensions {
  unidadeNome: string;
  ofertaVagasCursoNoturno: number | null;
  ofertaVagasCursoNoturnoPercentual: number | null;
  ofertaVagasGraduacao: number | null;
}

export const ofertaVagasNoturnasMapping: ColumnMapping<OfertaVagasNoturnasRow> = {
  fileType: "OFERTA_VAGAS_NOTURNAS",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    ofertaVagasCursoNoturno: {
      sourceHeaderCandidates: ["Oferta de Vagas | Curso Noturno"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Oferta de Vagas | Curso Noturno",
    },
    ofertaVagasCursoNoturnoPercentual: {
      sourceHeaderCandidates: ["Oferta de Vagas | Curso Noturno %"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Oferta de Vagas | Curso Noturno %",
    },
    ofertaVagasGraduacao: {
      sourceHeaderCandidates: ["Oferta de Vagas | Graduação"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Oferta de Vagas | Graduação",
    },
  },
};
