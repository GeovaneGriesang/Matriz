import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/** ProfessoresPorInstituicao.csv — número de docentes por titulação/jornada, por instituição. */
export interface ProfessoresPorInstituicaoRow extends SharedDimensions {
  titulacao: string;
  jornadaDeTrabalho: string;
  numeroDocentes: number | null;
}

export const professoresPorInstituicaoMapping: ColumnMapping<ProfessoresPorInstituicaoRow> = {
  fileType: "PROFESSORES_POR_INSTITUICAO",
  columns: {
    ...sharedDimensionColumns(),
    titulacao: {
      sourceHeaderCandidates: ["Titulação"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    jornadaDeTrabalho: {
      sourceHeaderCandidates: ["Jornada_de_Trabalho"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    numeroDocentes: {
      sourceHeaderCandidates: ["Servidores | Número de Docentes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Servidores | Número de Docentes",
    },
  },
};
