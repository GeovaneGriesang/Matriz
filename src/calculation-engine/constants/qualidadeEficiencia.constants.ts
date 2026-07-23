import type { IeaBand, RapBand } from "../types/qualidadeEficiencia.types";

/**
 * Faixas normativas do IEA e pesos aplicados, conforme Figura 6 ("Distribuição de
 * recursos conforme o IEA", dados do MEC/2022) do livro "A Matriz Orçamentária da
 * Rede Federal de EPCT" (CONIF/Forplan, 2025). O livro só documenta 4 faixas (não 5);
 * a faixa MUITO_BAIXO fica aberta abaixo de 42,07% (o livro não define o que ocorre
 * abaixo do piso observado em 2022) e a faixa MUITO_ALTO fica aberta acima de 56,49%.
 * `valorIea` chega em [0, 1] (a PNP entrega em escala 0-100%, convertido antes daqui).
 */
export const IEA_BAND_THRESHOLDS: { max: number; band: IeaBand }[] = [
  { max: 0.4707, band: "MUITO_BAIXO" }, // até 47,07%
  { max: 0.5178, band: "MEDIO" }, // 47,08% a 51,78%
  { max: 0.5648, band: "ALTO" }, // 51,79% a 56,48%
  { max: Infinity, band: "MUITO_ALTO" }, // 56,49% a 100%
];

export const IEA_BAND_WEIGHTS: Record<IeaBand, number> = {
  MUITO_BAIXO: 0.5,
  BAIXO: 1.0, // faixa não usada pelo IEA (o livro só define 4 faixas) — mantida só para satisfazer o tipo IeaBand.
  MEDIO: 1.5,
  ALTO: 2.0,
  MUITO_ALTO: 2.5,
};

/**
 * Faixas normativas da Relação Aluno-Professor (RAP) presencial e pesos aplicados,
 * conforme Figura 8 ("Distribuição de recursos conforme RAP", dados do MEC/2022) do
 * mesmo livro. Escala real (alunos por docente), não normalizada — o livro só
 * documenta 4 faixas; MUITO_BAIXA cobre 0 a 17,99 e MUITO_ALTA fica aberta acima de 22.
 */
export const RAP_BAND_THRESHOLDS: { max: number; band: RapBand }[] = [
  { max: 17.99, band: "MUITO_BAIXA" },
  { max: 19.99, band: "BAIXA" },
  { max: 21.99, band: "MEDIA" },
  { max: Infinity, band: "MUITO_ALTA" }, // a partir de 22
];

export const RAP_BAND_WEIGHTS: Record<RapBand, number> = {
  MUITO_BAIXA: 0,
  BAIXA: 1.0,
  MEDIA: 2.0,
  ALTA: 2.0, // faixa não usada pelo RAP (o livro só define 4 faixas) — mantida só para satisfazer o tipo RapBand.
  MUITO_ALTA: 2.5,
};

/** Divisão legal do sub-bloco IAPL (deve somar 1.0). */
export const IAPL_SPLIT = {
  CURSOS_TECNICOS: 0.7,
  FORMACAO_PROFESSORES: 0.2,
  PROEJA: 0.1,
} as const;
