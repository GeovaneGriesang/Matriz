import type { EstrategiaFaixasIea, IeaBand, RapBand } from "../types/qualidadeEficiencia.types";

/**
 * As duas tabelas NÃO são metodologias concorrentes: são o mesmo cálculo normativo (Portaria
 * MEC/SETEC 646/2022 — faixas relativas à média de IEA da rede naquele ciclo: <0,90×, 0,90-1,00×,
 * 1,00-1,10×, 1,10-1,20×, ≥1,20× da média), só "congeladas" com a média de anos-base diferentes.
 * Confirmado célula a célula contra `DADOS BASE!Q76:V81` da planilha-modelo 2026 (média de rede
 * 46,1% → limiares 41,49%/46,1%/50,71%/55,32%, EXATAMENTE 0,90×/1,00×/1,10×/1,20× de 0,461).
 * Por isso só a tabela do ciclo vigente pode ser usada no cálculo: aplicar a média congelada de
 * outro ano-base a este ciclo não é uma escolha metodológica válida, é comparar IEA com o limiar
 * errado. FORPLAN_2025 é mantida no código só como referência histórica (nunca descartada, nunca
 * selecionável para o ano corrente) — ver ESTRATEGIA_FAIXAS_IEA_SELECIONAVEL.
 */
export const ESTRATEGIA_FAIXAS_IEA_PADRAO: EstrategiaFaixasIea = "PLANILHA_2026";

/** Quais estratégias podem ser escolhidas para calcular o ciclo vigente — FORPLAN_2025 é só histórico. */
export const ESTRATEGIA_FAIXAS_IEA_SELECIONAVEL: Record<EstrategiaFaixasIea, boolean> = {
  PLANILHA_2026: true,
  FORPLAN_2025: false,
};

/** Texto exibido em qualquer tela que mostre a estratégia — fonte única para não divergir entre telas. */
export const ESTRATEGIA_FAIXAS_IEA_INFO: Record<EstrategiaFaixasIea, { label: string; descricao: string }> = {
  PLANILHA_2026: {
    label: "Faixas da planilha-modelo 2026 (único valor ativo)",
    descricao:
      "Limiares de IEA relativos à média de rede do ciclo 2026 (46,1%), extraídos de DADOS BASE!Q76:V81 da planilha oficial. Única tabela usada no cálculo do ciclo vigente.",
  },
  FORPLAN_2025: {
    label: "Faixas do ciclo 2025 (Forplan) — histórico, não usar no cálculo de 2026",
    descricao:
      "Mesma metodologia (Portaria MEC/SETEC 646/2022), só que congelada com a média de rede do ciclo 2025 — publicada no livro \"A Matriz Orçamentária da Rede Federal de EPCT\" (CONIF/Forplan, 2025). Mantida apenas como referência histórica; aplicar esses limiares a 2026 compararia o IEA com o ano-base errado.",
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
