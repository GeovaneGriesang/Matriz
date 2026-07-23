import type { PnpFileType } from "./fileTypes";

export interface ColumnDefinition<V> {
  /**
   * Nomes de header possíveis para esta coluna, na ordem de preferência.
   * Um array (em vez de um único nome) tolera variações entre versões do
   * export da PNP.
   */
  sourceHeaderCandidates: string[];
  required: boolean;
  transform: (raw: string) => V;
  /**
   * "dimension": identifica a linha (ano/geografia/instituição/unidade/curso/
   * categoria etc) — vira coluna de FK ou entra em FatoIndicador.dimensoesExtra.
   * "measure": um valor numérico da PNP — vira uma linha de FatoIndicador
   * (medida = measureLabel, valor = valor da coluna).
   */
  kind: "dimension" | "measure";
  /** Nome PNP literal da medida (ex: "Matrícula Equivalente | Geral"). Obrigatório quando kind === "measure". */
  measureLabel?: string;
}

export type ColumnMapping<T> = {
  fileType: PnpFileType;
  columns: { [K in keyof T]: ColumnDefinition<T[K]> };
};
