/**
 * Refaz, a partir dos indicadores já homologados que a própria MDO publica (Conclusão,
 * Evasão e Retenção do ciclo, RAP Presencial, %ME de cada categoria do IAPL), o caminho
 * até o valor em reais de cada instituição nos blocos IEA, RAP e IAPL de "Qualidade e
 * Eficiência". Existe só para conferência: comparar o que este módulo calcula com o que
 * a MDO já publicou (`DistribuicaoInstituicao`) e apontar onde os dois divergem. Nunca é
 * usado para decidir quanto uma instituição recebe; isso continua vindo pronto da MDO.
 *
 * Fórmulas confirmadas em docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md
 * (Guia de Referência Metodológica da PNP, MEC/SETEC) e validadas batendo ao centésimo
 * de ponto percentual contra o IFSUL em 2027 (IEA 40,71% → faixa MUITO_BAIXO → peso
 * 0,5×; RAP 18,54 → faixa BAIXA → peso 1,0×).
 */

export type FaixaIea = "MUITO_BAIXO" | "BAIXO" | "MEDIO" | "ALTO" | "MUITO_ALTO";
export type FaixaRap = "MUITO_BAIXA" | "BAIXA" | "MEDIA" | "MUITO_ALTA";

/**
 * Limiares de IEA relativos à média de rede do próprio ciclo (Portaria MEC/SETEC 646/2022:
 * 0,90× / 1,00× / 1,10× / 1,20× da média). Cada ciclo "congela" a tabela com a média
 * daquele ano-base; por isso não existe uma tabela única, e um ciclo sem tabela cadastrada
 * aqui não pode ser conferido (ver `faixaIea`).
 */
const IEA_FAIXAS_POR_ANO: Record<number, { max: number; faixa: FaixaIea }[]> = {
  2026: [
    { max: 0.4149, faixa: "MUITO_BAIXO" },
    { max: 0.461, faixa: "BAIXO" },
    { max: 0.5071, faixa: "MEDIO" },
    { max: 0.5532, faixa: "ALTO" },
    { max: Infinity, faixa: "MUITO_ALTO" },
  ],
  2027: [
    { max: 0.441, faixa: "MUITO_BAIXO" },
    { max: 0.49, faixa: "BAIXO" },
    { max: 0.539, faixa: "MEDIO" },
    { max: 0.588, faixa: "ALTO" },
    { max: Infinity, faixa: "MUITO_ALTO" },
  ],
};

const PESO_POR_FAIXA_IEA: Record<FaixaIea, number> = {
  MUITO_BAIXO: 0.5,
  BAIXO: 1.0,
  MEDIO: 1.5,
  ALTO: 2.0,
  MUITO_ALTO: 2.5,
};

/** Faixas absolutas de RAP Presencial (alunos por professor); não variam por ciclo. */
const RAP_FAIXAS: { max: number; faixa: FaixaRap }[] = [
  { max: 17.99, faixa: "MUITO_BAIXA" },
  { max: 19.99, faixa: "BAIXA" },
  { max: 21.99, faixa: "MEDIA" },
  { max: Infinity, faixa: "MUITO_ALTA" },
];

const PESO_POR_FAIXA_RAP: Record<FaixaRap, number> = {
  MUITO_BAIXA: 0,
  BAIXA: 1.0,
  MEDIA: 2.0,
  MUITO_ALTA: 2.5,
};

/** Pesos de categoria do IAPL Equalizado (somam 1,0). */
export const IAPL_PESO_CATEGORIA = { tecnicos: 0.7, formacaoProfessores: 0.2, proeja: 0.1 } as const;

/** Faixas de %ME por categoria do IAPL; não variam por ciclo. */
const IAPL_FAIXAS_TECNICOS = [
  { min: 0, peso: 0 },
  { min: 0.5, peso: 1.0 },
  { min: 0.6, peso: 2.0 },
];
const IAPL_FAIXAS_FORMACAO = [
  { min: 0, peso: 0 },
  { min: 0.1, peso: 1.0 },
  { min: 0.15, peso: 2.0 },
  { min: 0.2, peso: 2.5 },
];
const IAPL_FAIXAS_PROEJA = [
  { min: 0, peso: 0 },
  { min: 0.025, peso: 1.0 },
  { min: 0.05, peso: 2.0 },
  { min: 0.1, peso: 2.5 },
];

function pesoPorFaixaMinima(valor: number, faixas: { min: number; peso: number }[]): number {
  let peso = 0;
  for (const f of faixas) if (valor >= f.min) peso = f.peso;
  return peso;
}

/** Anos com tabela de faixas de IEA cadastrada; fora disso a conferência não é possível. */
export function anosComFaixaIeaDisponivel(): number[] {
  return Object.keys(IEA_FAIXAS_POR_ANO).map(Number).sort();
}

/**
 * IEA [%] = Conclusão-Ciclo + Retenção-Ciclo × (Conclusão-Ciclo / (Conclusão-Ciclo + Evasão-Ciclo)).
 * As três entradas já vêm homologadas pela MDO (aba INDICADORES); este módulo só aplica a fórmula.
 */
export function calcularIea(conclusao: number, evasao: number, retencao: number): number | null {
  const base = conclusao + evasao;
  if (base <= 0) return null;
  return conclusao + retencao * (conclusao / base);
}

export function faixaIea(iea: number, ano: number): FaixaIea | null {
  const tabela = IEA_FAIXAS_POR_ANO[ano];
  if (!tabela) return null;
  return tabela.find((f) => iea <= f.max)!.faixa;
}

export function pesoIea(faixa: FaixaIea): number {
  return PESO_POR_FAIXA_IEA[faixa];
}

export function faixaRap(rap: number): FaixaRap {
  return RAP_FAIXAS.find((f) => rap <= f.max)!.faixa;
}

export function pesoRap(faixa: FaixaRap): number {
  return PESO_POR_FAIXA_RAP[faixa];
}

export function pesoIaplTecnicos(percentualMe: number): number {
  return pesoPorFaixaMinima(percentualMe, IAPL_FAIXAS_TECNICOS);
}

export function pesoIaplFormacaoProfessores(percentualMe: number): number {
  return pesoPorFaixaMinima(percentualMe, IAPL_FAIXAS_FORMACAO);
}

export function pesoIaplProeja(percentualMe: number): number {
  return pesoPorFaixaMinima(percentualMe, IAPL_FAIXAS_PROEJA);
}
