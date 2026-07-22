import type { IeaBand, RapBand, RegimeTrabalho } from "../types/qualidadeEficiencia.types";

/**
 * Faixas normativas do IEA e pesos aplicados (0,5 a 2,5).
 * Thresholds são um placeholder (IEA normalizado em [0, 1], 5 faixas equidistantes) —
 * pendente de confirmação contra a Portaria MEC 646/2022 / planilha ground truth.
 */
export const IEA_BAND_THRESHOLDS: { max: number; band: IeaBand }[] = [
  { max: 0.2, band: "MUITO_BAIXO" },
  { max: 0.4, band: "BAIXO" },
  { max: 0.6, band: "MEDIO" },
  { max: 0.8, band: "ALTO" },
  { max: Infinity, band: "MUITO_ALTO" },
];

export const IEA_BAND_WEIGHTS: Record<IeaBand, number> = {
  MUITO_BAIXO: 0.5,
  BAIXO: 1.0,
  MEDIO: 1.5,
  ALTO: 2.0,
  MUITO_ALTO: 2.5,
};

/**
 * Peso por regime de trabalho docente, usado para compor "docentes equivalentes"
 * na razão docente/aluno do RAP. Placeholder — categorias e pesos exatos pendentes
 * de confirmação contra a norma oficial.
 */
export const REGIME_TRABALHO_WEIGHTS: Record<RegimeTrabalho, number> = {
  DEDICACAO_EXCLUSIVA: 1.0,
  QUARENTA_HORAS: 0.75,
  VINTE_HORAS: 0.5,
};

/**
 * Faixas normativas da razão docente/aluno presencial e pesos aplicados.
 * Placeholder (mesma escala 0,5–2,5 do IEA) — thresholds pendentes de confirmação.
 */
export const RAP_BAND_THRESHOLDS: { max: number; band: RapBand }[] = [
  { max: 0.05, band: "MUITO_BAIXA" },
  { max: 0.1, band: "BAIXA" },
  { max: 0.15, band: "MEDIA" },
  { max: 0.2, band: "ALTA" },
  { max: Infinity, band: "MUITO_ALTA" },
];

export const RAP_BAND_WEIGHTS: Record<RapBand, number> = {
  MUITO_BAIXA: 0.5,
  BAIXA: 1.0,
  MEDIA: 1.5,
  ALTA: 2.0,
  MUITO_ALTA: 2.5,
};

/** Divisão legal do sub-bloco IAPL (deve somar 1.0). */
export const IAPL_SPLIT = {
  CURSOS_TECNICOS: 0.7,
  FORMACAO_PROFESSORES: 0.2,
  PROEJA: 0.1,
} as const;
