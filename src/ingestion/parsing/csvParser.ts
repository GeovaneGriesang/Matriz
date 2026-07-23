import { parse } from "csv-parse/sync";

/**
 * Faz o parsing de um texto CSV em linhas de células (a primeira linha é o header).
 * Delimitador é `;` — padrão de todo export da PNP (a vírgula já é usada como
 * separador decimal no formato numérico brasileiro, ver `parseDecimalBr`).
 */
export function parseCsv(texto: string): string[][] {
  return parse(texto, {
    bom: true,
    trim: false,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    delimiter: ";",
  }) as string[][];
}
