import type { EstrategiaFaixasIea, IeaBand, RapBand } from "../types/qualidadeEficiencia.types";

/**
 * As duas tabelas NÃO são metodologias concorrentes: são o mesmo cálculo normativo (Portaria
 * MEC/SETEC 646/2022 — faixas relativas à média de IEA da rede naquele ciclo: <0,90×, 0,90-1,00×,
 * 1,00-1,10×, 1,10-1,20×, ≥1,20× da média), só "congeladas" com a média de anos-base diferentes.
 * Confirmado célula a célula contra `DADOS BASE!Q76:V81` da planilha-modelo 2026 (média de rede
 * 46,1% → limiares 41,49%/46,1%/50,71%/55,32%, EXATAMENTE 0,90×/1,00×/1,10×/1,20× de 0,461).
 * Por isso só a tabela do ciclo vigente pode ser usada no cálculo: aplicar a média congelada de
 * outro ano-base a este ciclo não é uma escolha metodológica válida, é comparar IEA com o limiar
 * errado. Cada ciclo tem a sua: a média subiu de 46,1% (2026) para 49,0% (2027).
 *
 * A tabela do livro CONIF/Forplan 2025 (4 faixas, pisos 47,07%/51,78%/56,48%) foi REMOVIDA em
 * 28/08/2026: com as planilhas oficiais de 2026 e 2027 em mãos, ficou claro que ela não corresponde
 * a nenhum dos ciclos que o sistema calcula, e mantê-la selecionável só oferecia uma forma de errar.
 */
export const ESTRATEGIA_FAIXAS_IEA_PADRAO: EstrategiaFaixasIea = "PLANILHA_2026";

/** Quais tabelas podem ser escolhidas no cálculo — hoje todas, uma por ciclo orçamentário. */
export const ESTRATEGIA_FAIXAS_IEA_SELECIONAVEL: Record<EstrategiaFaixasIea, boolean> = {
  PLANILHA_2026: true,
  PLANILHA_2027: true,
};

/** Texto exibido em qualquer tela que mostre a estratégia — fonte única para não divergir entre telas. */
export const ESTRATEGIA_FAIXAS_IEA_INFO: Record<EstrategiaFaixasIea, { label: string; descricao: string }> = {
  PLANILHA_2026: {
    label: "Faixas da planilha-modelo 2026",
    descricao:
      "Limiares de IEA relativos à média de rede do ciclo 2026 (46,1%), extraídos de DADOS BASE!Q76:V81 da planilha oficial. Use ao calcular o ciclo 2026.",
  },
  PLANILHA_2027: {
    label: "Faixas da planilha-modelo 2027",
    descricao:
      "Limiares de IEA relativos à média de rede do ciclo 2027 (49,0%), extraídos de DADOS BASE!Q77:V81 da planilha oficial de 2027. Use esta tabela ao calcular o ciclo 2027: das 42 instituições, 16 caem em faixa diferente da tabela de 2026, e todas as 16 conferem com esta.",
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
 * Faixas normativas do IEA — planilha-modelo oficial do ciclo 2027, `DADOS BASE!Q77:V81`. Mesma
 * metodologia da tabela de 2026 (Portaria MEC/SETEC 646/2022: 0,90×/1,00×/1,10×/1,20× da média de
 * rede), só que congelada com a média do ciclo 2027 — 49,0% em vez de 46,1%, o que desloca todos os
 * limiares para cima.
 *
 * Conferida contra a planilha 2027 pelo peso efetivamente aplicado (IEA ponderado ÷ IEA): das 42
 * instituições, 16 caem em faixa diferente da tabela de 2026, e as 16 batem com esta — nenhuma bate
 * com a de 2026. Calcular o ciclo 2027 com a tabela de 2026 erraria a faixa de mais de um terço da
 * rede.
 */
export const IEA_BAND_THRESHOLDS_PLANILHA_2027: { max: number; band: IeaBand }[] = [
  { max: 0.441, band: "MUITO_BAIXO" }, // até 44,10% (0,90 × 49,0%)
  { max: 0.49, band: "BAIXO" }, // 44,11% a 49,00% (a própria média da rede)
  { max: 0.539, band: "MEDIO" }, // 49,01% a 53,90% (1,10 × 49,0%)
  { max: 0.588, band: "ALTO" }, // 53,91% a 58,80% (1,20 × 49,0%)
  { max: Infinity, band: "MUITO_ALTO" }, // acima de 58,80%
];

/** Os cinco degraus de peso são os mesmos de 2026 — o que muda entre os ciclos são os limiares. */
export const IEA_BAND_WEIGHTS_PLANILHA_2027 = IEA_BAND_WEIGHTS_PLANILHA_2026;

export const IEA_BAND_THRESHOLDS_POR_ESTRATEGIA: Record<EstrategiaFaixasIea, { max: number; band: IeaBand }[]> = {
  PLANILHA_2026: IEA_BAND_THRESHOLDS_PLANILHA_2026,
  PLANILHA_2027: IEA_BAND_THRESHOLDS_PLANILHA_2027,
};

export const IEA_BAND_WEIGHTS_POR_ESTRATEGIA: Record<EstrategiaFaixasIea, Record<IeaBand, number>> = {
  PLANILHA_2026: IEA_BAND_WEIGHTS_PLANILHA_2026,
  PLANILHA_2027: IEA_BAND_WEIGHTS_PLANILHA_2027,
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
