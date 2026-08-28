import { createHash } from "node:crypto";
import type { ColumnMapping } from "../config/mappingTypes";

/**
 * Separador entre campos na serialização de uma linha. É o caractere de controle Unit Separator
 * (U+001F), escrito aqui via `fromCharCode` para não deixar um caractere invisível no código-fonte.
 * Ele não aparece em texto vindo de planilha, então não há risco de um valor que contenha o
 * separador fazer duas linhas diferentes produzirem a mesma serialização (e, portanto, o mesmo
 * digest).
 */
const SEPARADOR_CAMPO = String.fromCharCode(0x1f);

/** O que aconteceu com um ano específico durante a importação — exibido na tela de upload. */
export type ResultadoAno = "INSERIDO" | "ATUALIZADO" | "INALTERADO" | "REMOVIDO";

export interface ResumoAno {
  ano: number;
  resultado: ResultadoAno;
  /** Linhas do CSV pertencentes a este ano (0 quando o ano saiu do arquivo). */
  rowCount: number;
  deletedFactCount: number;
  insertedFactCount: number;
}

/**
 * Agrupa as linhas já mapeadas por ano-base. Todo fato tem `ano` obrigatório (`FatoIndicador.ano`),
 * então nenhuma linha fica de fora — linhas sem instituição já foram descartadas antes, no pipeline.
 */
export function agruparPorAno(rows: Record<string, unknown>[]): Map<number, Record<string, unknown>[]> {
  const porAno = new Map<number, Record<string, unknown>[]>();
  for (const row of rows) {
    const ano = row.ano as number;
    const lista = porAno.get(ano);
    if (lista === undefined) {
      porAno.set(ano, [row]);
    } else {
      lista.push(row);
    }
  }
  return porAno;
}

/**
 * Impressão digital do conteúdo de um ano, usada para decidir se ele precisa ser regravado.
 *
 * Calculada sobre as linhas **já mapeadas** (não sobre o texto cru do CSV), então não muda por
 * causa de encoding, ordem das colunas ou variação no nome do cabeçalho — só muda quando algum
 * valor efetivamente muda. Os campos entram em ordem alfabética fixa, para que acrescentar uma
 * coluna nova ao mapeamento não reordene silenciosamente o que já existia.
 *
 * As linhas são percorridas na ordem do arquivo. Se a PNP publicar o mesmo conteúdo em outra ordem,
 * o digest muda e o ano é reimportado à toa — desperdício, não erro. O contrário (conteúdo diferente
 * gerando o mesmo digest) é o que não pode acontecer, e não acontece.
 */
export function calcularDigestAno(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping<Record<string, unknown>>,
): string {
  const campos = Object.keys(mapping.columns).sort();
  const hash = createHash("sha256");
  for (const row of rows) {
    const serializada = campos
      .map((campo) => {
        const valor = row[campo];
        return valor === null || valor === undefined ? "" : String(valor);
      })
      .join(SEPARADOR_CAMPO);
    hash.update(serializada);
    hash.update("\n");
  }
  return hash.digest("hex");
}
