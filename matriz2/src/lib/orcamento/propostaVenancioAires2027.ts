/**
 * O projeto de lei orçamentária de 2027 do município de Venâncio Aires (Projeto de Lei do Executivo nº 96, de 19/11/2026), como
 * a Prefeitura o enviou à Câmara. Os anexos do projeto são PDFs assinados, e a maior parte deles é imagem, sem texto que se possa
 * ler; os números abaixo foram transcritos dos trechos com texto e conferidos pela soma (cada total fecha com as suas parcelas).
 * Quando o Tesouro publicar o RREO de 2027, a execução passa a vir do Siconfi, como a dos anos anteriores.
 */

export const PROJETO_2027 = {
  numero: "Projeto de Lei do Executivo nº 96/2026",
  enviadoEm: "19/11/2026",
  url: "https://www.venancioaires.rs.leg.br/proposicoes/0/0/1/0/37523",
  /** Art. 1º do projeto. */
  receitaEstimada: 491_676_940,
  despesaFixada: 514_206_194,
  /** A justificativa do mesmo projeto cita valores um pouco diferentes (item 2.1); ficam registrados para quem for conferir. */
  justificativa: { receita: 490_446_940, receitaPrefeitura: 418_996_940, receitaPrevidencia: 71_450_000, despesa: 513_312_000, despesaPrefeitura: 427_875_000, despesaCamara: 13_987_000, despesaPrevidencia: 71_450_000 },
  /** Percentuais mínimos previstos na justificativa (Anexos XII e XIII): a Constituição exige 15% na saúde e 25% na educação. */
  saudePercentual: 28,
  educacaoPercentual: 26,
  fonte: "Projeto de Lei nº 96/2026 (LOA 2027), art. 1º e justificativa, Câmara Municipal de Venâncio Aires",
} as const;

export interface LinhaDoGrupo {
  grupo: string;
  /** Executado em 2025, fixado na LOA 2026 e proposto para 2027. */
  executado2025: number;
  fixado2026: number;
  proposto2027: number;
  nivel: "categoria" | "grupo" | "total";
}

/** Anexo VIII do projeto, quadro do Executivo e Legislativo (sem o Fundo de Previdência). */
export const DESPESA_EXECUTIVO_LEGISLATIVO: LinhaDoGrupo[] = [
  { grupo: "Despesas correntes", executado2025: 377_674_441.16, fixado2026: 384_981_982.71, proposto2027: 410_438_703, nivel: "categoria" },
  { grupo: "Pessoal e encargos sociais", executado2025: 180_507_582.61, fixado2026: 194_448_250, proposto2027: 205_043_588, nivel: "grupo" },
  { grupo: "Juros e encargos da dívida", executado2025: 12_521_475.09, fixado2026: 16_170_000, proposto2027: 17_837_000, nivel: "grupo" },
  { grupo: "Outras despesas correntes", executado2025: 184_645_383.46, fixado2026: 174_363_732.71, proposto2027: 187_558_115, nivel: "grupo" },
  { grupo: "Despesas de capital", executado2025: 45_083_700.01, fixado2026: 41_374_725.73, proposto2027: 22_891_450, nivel: "categoria" },
  { grupo: "Investimentos", executado2025: 35_695_079.5, fixado2026: 26_187_725.73, proposto2027: 12_056_950, nivel: "grupo" },
  { grupo: "Inversões financeiras", executado2025: 340_159, fixado2026: 322_000, proposto2027: 5_199_800, nivel: "grupo" },
  { grupo: "Amortização da dívida", executado2025: 9_048_461.51, fixado2026: 14_865_000, proposto2027: 5_634_700, nivel: "grupo" },
  { grupo: "Reserva de contingência", executado2025: 0, fixado2026: 1_343_291.56, proposto2027: 9_426_041, nivel: "categoria" },
  { grupo: "Total", executado2025: 422_758_141.17, fixado2026: 427_700_000, proposto2027: 442_756_194, nivel: "total" },
];

/** O Fundo de Previdência Social do Município (FPSM), que paga as aposentadorias dos servidores: proposto para 2027. */
export const PREVIDENCIA_2027 = { total: 71_450_000, correntes: 49_875_000, capital: 25_000, reserva: 21_550_000 } as const;

/** Os principais investimentos previstos para 2027 (justificativa, Quadro 09), com a origem do dinheiro. */
export const INVESTIMENTOS_2027: { origem: string; objeto: string }[] = [
  { origem: "Recursos próprios e venda de bens", objeto: "Prédios públicos, vias urbanas e rurais, praças, água, saneamento, tecnologia da informação e pavimentação comunitária" },
  { origem: "Educação (MDE)", objeto: "Subestações de energia nas EMEIs; PPCI das EMEIs e EMEFs; reforma e ampliação das EMEFs Benno Breunig e Professora Odila da Rosa Scherer" },
  { origem: "União (calamidade, Portaria 3033/2020)", objeto: "Construção da UBS Mariante, na Estância; reconstrução de pontes" },
  { origem: "Banco do Brasil (contrato 40/00055-9)", objeto: "Pavimentação etapa 5, capeamento da VR 816, loteamento social Estância Nova" },
  { origem: "Emendas especiais da União (transferência especial)", objeto: "Pontes, revitalização da Rua Osvaldo Aranha, pavimentação da Linha Tangerinas, feira e pavilhão da agricultura familiar" },
  { origem: "Governo do Estado", objeto: "Projeto de drenagem e ponte" },
  { origem: "Ministérios (contratos de repasse pela Caixa)", objeto: "CRAS e CREAS do Bairro Cruzeiro; ampliação do pavilhão agropecuário" },
];

/**
 * As emendas impositivas previstas na LDO de 2027 (notícia da Câmara sobre a audiência pública de 28/10/2026): o valor que os
 * vereadores podem destinar no orçamento de 2027, por bancada e por vereador.
 */
export const EMENDAS_IMPOSITIVAS_PREVISTAS_2027 = {
  total: 8_420_000,
  bancadas: 3_830_000,
  individuais: 4_590_000,
  porVereador: 306_401.46,
  observacao: "Metade do valor individual vai obrigatoriamente para a saúde.",
  fonte: "Câmara Municipal de Venâncio Aires, notícia da audiência pública da LDO 2027 (28/10/2026)",
  url: "https://www.venancioaires.rs.leg.br/imprensa/noticias/0/1/2026/9114",
} as const;
