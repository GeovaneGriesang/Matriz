import { ehQualificacaoProfissional } from "./regrasCiclo";

/**
 * Matrícula equivalente (Mateq), da Portaria Setec 146/2021, art. 2º: Mat x fech x fec. É a base dos percentuais legais (art. 4º) e da
 * relação de matrículas por professor (art. 5º). Não é a Matrícula Total da MDO, que usa outra conta para distribuir o orçamento.
 *
 * Fora do FIC, fech = 1. No FIC, a portaria fala em carga horária mínima ÷ 800, mas a PNP publica com a carga horária do curso ÷ 800.
 * Seguimos a PNP, porque só assim os números coincidem: conferido em 2026-11-05 no IFSul, ano-base 2025, tipo de curso por tipo de curso
 * (FIC 7.312,9, total 29.113,6). Com a carga mínima, o FIC daria 27.813,9.
 */
const CH_PADRAO_ANUAL = 800;

export function fatorMatriculaEquivalente(c: { tipoCurso: string; fatorEsforco: number; cargaHoraria: number }): number {
  const fech = ehQualificacaoProfissional(c.tipoCurso) ? c.cargaHoraria / CH_PADRAO_ANUAL : 1;
  return fech * c.fatorEsforco;
}

/** O fec quando a PNP não traz a turma nem o curso: o do Anexo II para FIC, e 1 para os demais, que é o valor mais comum da tabela. */
export function fatorEsforcoPadrao(tipoCurso: string): number {
  return ehQualificacaoProfissional(tipoCurso) ? 1.1 : 1;
}

/** Nome de curso sem acento e em maiúsculas: a MDO grava assim, e a PNP com acento. */
export function nomeDeCursoNormalizado(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

/** A chave de um curso na busca do fec. */
export const chaveDoFatorEsforco = (tipoCurso: string, curso: string) => `${nomeDeCursoNormalizado(tipoCurso)}|${nomeDeCursoNormalizado(curso)}`;
