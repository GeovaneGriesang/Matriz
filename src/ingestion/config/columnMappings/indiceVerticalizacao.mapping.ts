import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** IndiceVerticalizacao.csv — vagas por nível (CG/CT/PG/QP) e índice por eixo, por câmpus. */
export interface IndiceVerticalizacaoRow extends SharedDimensions {
  unidadeNome: string;
  vagasCg: number | null;
  vagasCt: number | null;
  vagasPg: number | null;
  vagasQp: number | null;
  eixoTecnologico: number | null;
}

export const indiceVerticalizacaoMapping: ColumnMapping<IndiceVerticalizacaoRow> = {
  fileType: "INDICE_VERTICALIZACAO",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    vagasCg: {
      sourceHeaderCandidates: ["Índice de Verticalização | Vagas - CG"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Índice de Verticalização | Vagas - CG",
    },
    vagasCt: {
      sourceHeaderCandidates: ["Índice de Verticalização | Vagas - CT"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Índice de Verticalização | Vagas - CT",
    },
    vagasPg: {
      sourceHeaderCandidates: ["Índice de Verticalização | Vagas - PG"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Índice de Verticalização | Vagas - PG",
    },
    vagasQp: {
      sourceHeaderCandidates: ["Índice de Verticalização | Vagas - QP"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Índice de Verticalização | Vagas - QP",
    },
    eixoTecnologico: {
      sourceHeaderCandidates: ["Índice de Verticalização | Eixo Tecnológico"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Índice de Verticalização | Eixo Tecnológico",
    },
  },
};
