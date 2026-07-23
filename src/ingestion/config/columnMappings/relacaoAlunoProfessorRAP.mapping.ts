import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/**
 * RelacaoAlunoProfessorRAP.csv — razão Aluno/Professor (RAP) já calculada
 * pela PNP, por câmpus/ano. `rap` alimenta direto o Bloco de Qualidade e
 * Eficiência (não precisa recalcular a partir de docentes por regime).
 */
export interface RelacaoAlunoProfessorRapRow extends SharedDimensions {
  unidadeNome: string;
  rap: number | null;
  matriculasRap: number | null;
  professorEquivalente: number | null;
}

export const relacaoAlunoProfessorRapMapping: ColumnMapping<RelacaoAlunoProfessorRapRow> = {
  fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    rap: {
      sourceHeaderCandidates: ["RAP | RAP"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "RAP | RAP",
    },
    matriculasRap: {
      sourceHeaderCandidates: ["RAP | Matrículas RAP"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "RAP | Matrículas RAP",
    },
    professorEquivalente: {
      sourceHeaderCandidates: ["RAP | Professor Equivalente"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "RAP | Professor Equivalente",
    },
  },
};
