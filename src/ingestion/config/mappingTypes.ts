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
  /**
   * Quando true, tolera célula vazia mesmo com `required: true` — a coluna
   * continua obrigatória (deve existir no header), mas linhas com valor vazio
   * não geram ERROR. Uso: dimensões onde a própria PNP registra "não
   * informado" como string vazia (confirmado com dado real, não presumir).
   */
  allowEmptyValue?: boolean;
  /**
   * Quando true, isenta esta medida da checagem de não-negatividade. Uso:
   * medidas que são deltas contábeis e podem legitimamente ficar negativas
   * (ex: despesa empenhada a liquidar, por estornos entre exercícios) —
   * confirmado com dado real, não presumir.
   */
  allowNegativeValue?: boolean;
}

export type ColumnMapping<T> = {
  fileType: PnpFileType;
  columns: { [K in keyof T]: ColumnDefinition<T[K]> };
};
