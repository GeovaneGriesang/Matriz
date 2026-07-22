import { parse } from "csv-parse/sync";

/** Faz o parsing de um texto CSV em linhas de células (a primeira linha é o header). */
export function parseCsv(texto: string): string[][] {
  return parse(texto, {
    bom: true,
    trim: false,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][];
}
