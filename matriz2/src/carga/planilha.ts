import crypto from "node:crypto";
import fs from "node:fs";

/**
 * Uma célula do exceljs pode vir como número, texto, data, nulo, `{ formula, result }`
 * quando é fórmula, `{ richText }` quando tem formatação por trecho, ou `{ error }`.
 * Tudo que lê planilha aqui passa por esta função, para não espalhar essa checagem.
 */
export function valorDaCelula(bruto: unknown): unknown {
  if (bruto === null || bruto === undefined) return null;
  if (typeof bruto === "object") {
    const o = bruto as Record<string, unknown>;
    if ("result" in o) return valorDaCelula(o.result);
    if ("richText" in o) {
      const partes = o.richText as { text: string }[];
      return partes.map((p) => p.text).join("");
    }
    if ("error" in o) return null;
    if (bruto instanceof Date) return bruto;
  }
  return bruto;
}

export function texto(bruto: unknown): string | null {
  const v = valorDaCelula(bruto);
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function numero(bruto: unknown): number | null {
  const v = valorDaCelula(bruto);
  if (v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Como `numero`, mas troca ausência por zero. Para colunas de dinheiro, onde vazio é zero mesmo. */
export function numeroOuZero(bruto: unknown): number {
  return numero(bruto) ?? 0;
}

/**
 * O leitor em fluxo do exceljs entrega datas como número de série do Excel, não como
 * `Date` (o leitor normal converte, o de fluxo não). O sistema 1900 do Excel conta
 * dias a partir de 1899-12-30, e não de 1900-01-01, por causa do bug histórico do
 * ano bissexto de 1900 que a Microsoft manteve por compatibilidade.
 */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function data(bruto: unknown): Date | null {
  const v = valorDaCelula(bruto);
  if (v === null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    if (v <= 0) return null;
    return new Date(EPOCA_EXCEL + Math.round(v) * MS_POR_DIA);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** SHA-256 do arquivo, para reconhecer quando a mesma exportação é recarregada. */
export function checksumArquivo(caminho: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(caminho)).digest("hex");
}

/**
 * As planilhas da MDO carregam a data de geração num texto solto do cabeçalho, no
 * formato "Gerado em 30/08/2026, 12:07:47". É a data do DADO, diferente da data da
 * carga, e é ela que precisa aparecer na tela ao lado do número.
 */
export function dataDeGeracao(textoDoCabecalho: string | null): Date | null {
  if (!textoDoCabecalho) return null;
  const m = textoDoCabecalho.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, dia, mes, ano, hh, mm, ss] = m;
  return new Date(
    Number(ano),
    Number(mes) - 1,
    Number(dia),
    Number(hh ?? 0),
    Number(mm ?? 0),
    Number(ss ?? 0),
  );
}
