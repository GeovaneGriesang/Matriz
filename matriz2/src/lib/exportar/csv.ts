/**
 * Exportação de tabelas para CSV, pensada para abrir direto no Excel em português do Brasil: separador ponto e vírgula, decimal com
 * vírgula, UTF-8 com marca de ordem de bytes (BOM) para os acentos e quebra de linha CRLF.
 *
 * O texto das células é o que a pessoa vê na tela ("R$ 1.875.091", "64,0%"). Valores em reais e números com ponto de milhar viram número
 * puro ("1875091"), para o Excel somar; percentuais mantêm o "%" (o Excel os entende). Funções puras: nada aqui toca o navegador.
 */

const MOEDA = /^([+-])?\s*R\$\s*([\d.]+)(,\d+)?$/;
const NUMERO_COM_MILHAR = /^(-)?(\d{1,3}(?:\.\d{3})+)(,\d+)?$/;
const PERCENTUAL_COM_MILHAR = /^(-)?(\d{1,3}(?:\.\d{3})+)(,\d+)?%$/;

/** Limpa o texto de uma célula e converte os números em formato brasileiro para número puro. */
export function normalizarCelula(texto: string): string {
  const t = texto
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .replace(/(\d)\s+%/g, "$1%")
    .trim();
  const moeda = MOEDA.exec(t);
  if (moeda) return `${moeda[1] === "-" ? "-" : ""}${moeda[2]!.replace(/\./g, "")}${moeda[3] ?? ""}`;
  const milhar = NUMERO_COM_MILHAR.exec(t);
  if (milhar) return `${milhar[1] ?? ""}${milhar[2]!.replace(/\./g, "")}${milhar[3] ?? ""}`;
  const percentual = PERCENTUAL_COM_MILHAR.exec(t);
  if (percentual) return `${percentual[1] ?? ""}${percentual[2]!.replace(/\./g, "")}${percentual[3] ?? ""}%`;
  return t;
}

/** Aspas quando o valor tem separador, aspas ou quebra de linha; e uma proteção contra fórmula (=, @, + ou - seguidos de texto) ao abrir no Excel. */
export function escaparCsv(valor: string, separador = ";"): string {
  let v = valor;
  // Um traço sozinho (célula vazia na tela) não é fórmula; "-texto" e "=...", sim.
  if (/^[=@]/.test(v) || (v.length > 1 && /^[+-]/.test(v) && !/^[+-]?\d/.test(v))) v = `'${v}`;
  return /[";\r\n]/.test(v) || v.includes(separador) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** O arquivo CSV completo, com BOM no início e CRLF entre as linhas. */
export function montarCsv(linhas: string[][], separador = ";"): string {
  return `﻿${linhas.map((l) => l.map((c) => escaparCsv(c, separador)).join(separador)).join("\r\n")}\r\n`;
}

/** Nome de arquivo a partir de um título: sem acento, minúsculo, hifenizado e com no máximo 60 caracteres. */
export function nomeDeArquivo(titulo: string, extensao = "csv"): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "tabela"}.${extensao}`;
}
