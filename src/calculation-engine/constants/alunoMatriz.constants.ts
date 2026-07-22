import type { LabInfraTier, ModalidadeEnsino } from "../types/alunoMatriz.types";

/** Pesos por modalidade de ensino. Portaria MEC 646/2022 (pendente verificação contra ground truth). */
export const MODALIDADE_WEIGHTS: Record<ModalidadeEnsino, number> = {
  PRESENCIAL: 1.0,
  EAD_PROPRIO: 0.8,
  EAD_FOMENTO_EXTERNO: 0.25,
};

/** Bonificação de +50% para cursos do eixo tecnológico agropecuário. */
export const BONUS_EIXO_AGRICOLA = 1.5;

/** Peso por infraestrutura de laboratórios, alinhado ao CNCT. */
export const LAB_INFRA_WEIGHT_BY_TIER: Record<LabInfraTier, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.0,
  4: 2.5,
};

/** Peso fixo mínimo aplicado a cursos Técnicos Integrados. */
export const PESO_MINIMO_TECNICO_INTEGRADO = 1.5;

/**
 * Janela atemporal (em dias) para ponderação por retenção em ciclo regular.
 * O multiplicador exato aplicado dentro/fora da janela ainda não foi confirmado
 * contra a norma oficial — ver Pendências no plano de M1.
 */
export const JANELA_RETENCAO_DIAS = 1095;

/**
 * Multiplicador de ponderação por retenção. Dentro da janela atemporal (≤ 1095 dias),
 * a matrícula conta com peso pleno; fora da janela (retenção no ciclo), o peso é
 * reduzido. O valor exato da redução é um placeholder pendente de confirmação —
 * ver Pendências no plano de M1.
 */
export const PESO_RETENCAO_DENTRO_JANELA = 1.0;
export const PESO_RETENCAO_FORA_JANELA = 0.5;

/** Fator aplicado a matrículas de Pós-Graduação Stricto Sensu (substitui os demais pesos). */
export const FATOR_STRICTO_SENSU = 3.75;
