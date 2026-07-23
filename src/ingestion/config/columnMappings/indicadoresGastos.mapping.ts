import type { ColumnMapping } from "../mappingTypes";
import { parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, type SharedDimensions } from "./shared";

/** IndicadoresGastos.csv — gastos correntes por categoria, por instituição. */
export interface IndicadoresGastosRow extends SharedDimensions {
  gastosPorMatriculaEquivalente: number | null;
  gastosTotais: number | null;
  gastosCorrentes: number | null;
  inativosPensionistas: number | null;
  investimentosInversoesFinanceiras: number | null;
  precatorios: number | null;
  outrosCusteios: number | null;
  pessoal: number | null;
}

export const indicadoresGastosMapping: ColumnMapping<IndicadoresGastosRow> = {
  fileType: "INDICADORES_GASTOS",
  columns: {
    ...sharedDimensionColumns(),
    gastosPorMatriculaEquivalente: {
      sourceHeaderCandidates: ["Gastos Correntes por matrícula equivalente"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes por matrícula equivalente",
    },
    gastosTotais: {
      sourceHeaderCandidates: ["Gastos Correntes | Gastos Totais"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes | Gastos Totais",
    },
    gastosCorrentes: {
      sourceHeaderCandidates: ["Gastos Correntes | Gastos Correntes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes | Gastos Correntes",
    },
    inativosPensionistas: {
      sourceHeaderCandidates: ["Gastos Correntes | Inativos e Pensionistas"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes | Inativos e Pensionistas",
    },
    investimentosInversoesFinanceiras: {
      sourceHeaderCandidates: ["Gastos Correntes | Investimentos e Inversões Financeiras"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes | Investimentos e Inversões Financeiras",
    },
    precatorios: {
      sourceHeaderCandidates: ["Gastos Correntes | Precatórios"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes | Precatórios",
    },
    outrosCusteios: {
      sourceHeaderCandidates: ["Gastos Correntes | Outros Custeios"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes | Outros Custeios",
    },
    pessoal: {
      sourceHeaderCandidates: ["Gastos Correntes | Pessoal"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Gastos Correntes | Pessoal",
    },
  },
};
