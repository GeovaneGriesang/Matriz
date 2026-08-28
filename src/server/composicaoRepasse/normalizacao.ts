import type { CategoriaRepasse } from "@prisma/client";

/**
 * Aceita as variações de rótulo da planilha "Composição de Repasse" da CONIF e devolve a categoria
 * do enum. A planilha escreve "EAD MOOC"/"EAD FP" com espaço; o banco usa EAD_MOOC/EAD_FP. Acentos,
 * caixa e separadores (espaço, hífen, underscore) são ignorados porque exportações para CSV variam.
 */
export function normalizarCategoriaRepasse(valor: string): CategoriaRepasse | null {
  const limpo = valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
  if (limpo === "PRESENCIAL") return "PRESENCIAL";
  if (limpo === "EAD") return "EAD";
  if (limpo === "EAD MOOC" || limpo === "MOOC") return "EAD_MOOC";
  if (limpo === "EAD FP" || limpo === "FP") return "EAD_FP";
  return null;
}

/**
 * Converte a coluna "Porcentagem" da planilha em multiplicador (fração).
 *
 * A CONIF publica como fração (1 / 0,8 / 0,25 / 0,08), mas exportar para CSV às vezes produz "25%"
 * ou "25". Aceita as três formas. Sem "%", um número acima de 1 é tratado como percentual
 * (80 -> 0,8), o que cobre o Excel ter multiplicado por 100 ao salvar; acima de 100 é recusado, para
 * não transformar um erro de digitação em peso silenciosamente errado.
 *
 * Aceita vírgula ou ponto como separador decimal. O ponto só é descartado como separador de milhar
 * quando há vírgula decimal na string ("1.234,5"), senão "0.25" viraria 25.
 */
export function normalizarPesoRepasse(valor: string): number | null {
  const bruto = valor.trim();
  if (bruto === "") return null;
  const temPercentual = bruto.includes("%");
  const semPercentual = bruto.replace("%", "").trim();
  const temVirgulaDecimal = semPercentual.includes(",");
  const normalizado = temVirgulaDecimal
    ? semPercentual.replace(/\./g, "").replace(",", ".")
    : semPercentual;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0) return null;
  if (numero > 100) return null;
  const fracao = temPercentual || numero > 1 ? numero / 100 : numero;
  return fracao > 1 ? null : fracao;
}
