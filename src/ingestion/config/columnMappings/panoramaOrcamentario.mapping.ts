import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/** PanoramaOrcamentario.csv — execução orçamentária por instituição, órgão e resultado primário. */
export interface PanoramaOrcamentarioRow extends SharedDimensions {
  relacaoOrgao: string;
  resultadoPrimario: string;
  dotacaoAtualizada: number | null;
  despesaEmpenhada: number | null;
  despesaLiquidada: number | null;
  despesaPaga: number | null;
  despesaLiqRp: number | null;
  despesaEmpenhadaALiquidar: number | null;
  creditoDisponivel: number | null;
}

export const panoramaOrcamentarioMapping: ColumnMapping<PanoramaOrcamentarioRow> = {
  fileType: "PANORAMA_ORCAMENTARIO",
  columns: {
    ...sharedDimensionColumns(),
    relacaoOrgao: {
      sourceHeaderCandidates: ["Relação do Órgão"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    // Confirmado no export nacional real: 1 linha (execução zerada) não tem
    // Resultado Primário classificado — valor legítimo da PNP, não dado quebrado.
    resultadoPrimario: {
      sourceHeaderCandidates: ["Resultado Primário (Cidadã)"],
      required: true,
      allowEmptyValue: true,
      transform: identity,
      kind: "dimension",
    },
    dotacaoAtualizada: {
      sourceHeaderCandidates: ["Dotação atualizada"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Dotação atualizada",
    },
    despesaEmpenhada: {
      sourceHeaderCandidates: ["Despesa empenhada"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Despesa empenhada",
    },
    despesaLiquidada: {
      sourceHeaderCandidates: ["Despesa liquidada"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Despesa liquidada",
    },
    despesaPaga: {
      sourceHeaderCandidates: ["Despesa paga"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Despesa paga",
    },
    despesaLiqRp: {
      sourceHeaderCandidates: ["Despesa liq&RP"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Despesa liq&RP",
    },
    // Confirmado no export nacional real: único campo do arquivo com valores
    // negativos (199 linhas) — delta contábil (empenhado - liquidado) que pode
    // ficar negativo por estornos entre exercícios, não é dado inválido.
    despesaEmpenhadaALiquidar: {
      sourceHeaderCandidates: ["Despesa empenhada a liquidar"],
      required: true,
      allowNegativeValue: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Despesa empenhada a liquidar",
    },
    creditoDisponivel: {
      sourceHeaderCandidates: ["Crédito Disponível"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Crédito Disponível",
    },
  },
};
