import type { PnpFileType } from "./fileTypes";

export interface ColumnDefinition<V> {
  /**
   * Nomes de header possíveis para esta coluna, na ordem de preferência.
   * Um array (em vez de um único nome) tolera variações entre versões do
   * export da PNP — ver TODOs em cada arquivo de mapeamento.
   */
  sourceHeaderCandidates: string[];
  required: boolean;
  transform: (raw: string) => V;
}

export type ColumnMapping<T> = {
  fileType: PnpFileType;
  columns: { [K in keyof T]: ColumnDefinition<T[K]> };
};
