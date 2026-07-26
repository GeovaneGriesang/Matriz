import type { EstrategiaFaixasIea, IeaBand, RapBand } from "../types/qualidadeEficiencia.types";

/**
 * Duas fontes oficiais documentam faixas/pesos de IEA diferentes — nenhuma é descartada, o sistema
 * mantém as duas disponíveis e deixa o usuário escolher (ver EstrategiaFaixasIea). `valorIea`
 * chega em [0, 1] (a PNP entrega em escala 0-100%, convertido antes das faixas) em ambos os casos.
 */
export const ESTRATEGIA_FAIXAS_IEA_PADRAO: EstrategiaFaixasIea = "PLANILHA_2026";

/** Texto exibido em qualquer tela onde a estratégia possa ser escolhida — fonte única para não divergir entre telas. */
export const ESTRATEGIA_FAIXAS_IEA_INFO: Record<EstrategiaFaixasIea, { label: string; descricao: string }> = {
  PLANILHA_2026: {
    label: "Faixas da planilha-modelo 2026 (padrão)",
    descricao:
      "Usa os limites de IEA definidos na planilha oficial do ciclo orçamentário de 2026.",
  },
  FORPLAN_2025: {
    label: "Faixas do livro Forplan/2025",
    descricao:
      "Usa os limites publicados no livro \"A Matriz Orçamentária da Rede Federal de EPCT\" (CONIF/Forplan, 2025) — pode divergir da planilha-modelo do ciclo vigente.",
  },
};

/**
 * Faixas normativas do IEA — planilha-modelo oficial do ciclo orçamentário de 2026 (seção 2.1 de
 * docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md, extraída de `DADOS BASE!Q77:V81`).
 * Única das duas tabelas que usa os 5 degraus de peso (0,5x a 2,5x).
 */
export const IEA_BAND_THRESHOLDS_PLANILHA_2026: { max: number; band: IeaBand }[] = [
  { max: 0.4149, band: "MUITO_BAIXO" }, // até 41,49%
  { max: 0.461, band: "BAIXO" }, // 41,50% a 46,10%
  { max: 0.5071, band: "MEDIO" }, // 46,11% a 50,71%
  { max: 0.5532, band: "ALTO" }, // 50,72% a 55,32%
  { max: Infinity, band: "MUITO_ALTO" }, // 55,33% a 100%
];

export const IEA_BAND_WEIGHTS_PLANILHA_2026: Record<IeaBand, number> = {
  MUITO_BAIXO: 0.5,
  BAIXO: 1.0,
  MEDIO: 1.5,
  ALTO: 2.0,
  MUITO_ALTO: 2.5,
};

/**
 * Faixas normativas do IEA — livro "A Matriz Orçamentária da Rede Federal de EPCT" (CONIF/Forplan,
 * 2025), Figura 6 ("Distribuição de recursos conforme o IEA", dados do MEC/2022). O livro só
 * documenta 4 faixas (não 5); a faixa MUITO_BAIXO fica aberta abaixo de 47,07% e a faixa
 * MUITO_ALTO fica aberta acima de 56,49%.
 */
export const IEA_BAND_THRESHOLDS_FORPLAN_2025: { max: number; band: IeaBand }[] = [
  { max: 0.4707, band: "MUITO_BAIXO" }, // até 47,07%
  { max: 0.5178, band: "MEDIO" }, // 47,08% a 51,78%
  { max: 0.5648, band: "ALTO" }, // 51,79% a 56,48%
  { max: Infinity, band: "MUITO_ALTO" }, // 56,49% a 100%
];

export const IEA_BAND_WEIGHTS_FORPLAN_2025: Record<IeaBand, number> = {
  MUITO_BAIXO: 0.5,
  BAIXO: 1.0, // faixa não usada por esta tabela (o livro só define 4 faixas) — mantida só para satisfazer o tipo IeaBand.
  MEDIO: 1.5,
  ALTO: 2.0,
  MUITO_ALTO: 2.5,
};

export const IEA_BAND_THRESHOLDS_POR_ESTRATEGIA: Record<EstrategiaFaixasIea, { max: number; band: IeaBand }[]> = {
  PLANILHA_2026: IEA_BAND_THRESHOLDS_PLANILHA_2026,
  FORPLAN_2025: IEA_BAND_THRESHOLDS_FORPLAN_2025,
};

export const IEA_BAND_WEIGHTS_POR_ESTRATEGIA: Record<EstrategiaFaixasIea, Record<IeaBand, number>> = {
  PLANILHA_2026: IEA_BAND_WEIGHTS_PLANILHA_2026,
  FORPLAN_2025: IEA_BAND_WEIGHTS_FORPLAN_2025,
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
