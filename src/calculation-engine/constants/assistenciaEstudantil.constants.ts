/**
 * Pesos por faixa de RFP (Renda Familiar Per Capita) para o Bloco de
 * Assistência Estudantil (Ação 2994 / PNAES) — escala oficial da Matriz de
 * Distribuição Orçamentária da Rede Federal (PNP), de 2,5 (menor renda) a 0
 * (maior renda / não declarada). As faixas vêm como dimensão categórica
 * `rendaFamiliar` do arquivo ClassificacaoRacialRendaSexo.csv da PNP —
 * dado só existe por instituição, não por câmpus (ver blocoAssistenciaEstudantil.ts).
 */
export const RFP_FAIXA_PESOS: Record<string, number> = {
  "0<RFP<=0,5": 2.5,
  "0,5<RFP<=1": 2.0,
  "1<RFP<=1,5": 1.5,
  "1,5<RFP<=2,5": 1.0,
  "2,5<RFP<=3,5": 0.5,
  "RFP>3,5": 0,
};

/** Faixas sem peso definido (ex.: "Não declarada", "S/I") são excluídas do rateio (peso 0). */
export function pesoRfp(faixa: string): number {
  return RFP_FAIXA_PESOS[faixa] ?? 0;
}
