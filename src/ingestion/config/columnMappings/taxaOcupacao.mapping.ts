import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/** TaxaOcupacao.csv — taxa de ocupação de vagas, só por instituição (sem câmpus no export real). */
export interface TaxaOcupacaoRow extends SharedDimensions {
  matriculasCiclosVigentes: number | null;
  vagasCiclosVigentes: number | null;
  taxaOcupacaoPercentual: number | null;
}

export const taxaOcupacaoMapping: ColumnMapping<TaxaOcupacaoRow> = {
  fileType: "TAXA_OCUPACAO",
  columns: {
    ...sharedDimensionColumns(),
    matriculasCiclosVigentes: {
      sourceHeaderCandidates: ["Taxa de Ocupação | Matriculas Ciclos Vigentes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Taxa de Ocupação | Matriculas Ciclos Vigentes",
    },
    vagasCiclosVigentes: {
      sourceHeaderCandidates: ["Taxa de Ocupação | Vagas Ciclos Vigentes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Taxa de Ocupação | Vagas Ciclos Vigentes",
    },
    taxaOcupacaoPercentual: {
      sourceHeaderCandidates: ["Taxa de Ocupação | Taxa de Ocupação"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Taxa de Ocupação | Taxa de Ocupação",
    },
  },
};
