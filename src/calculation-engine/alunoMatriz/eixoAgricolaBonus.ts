import { BONUS_EIXO_AGRICOLA } from "../constants/alunoMatriz.constants";

/** Aplica a bonificação de +50% ao peso base quando o curso pertence ao eixo agropecuário. */
export function eixoAgricolaBonus(eixoAgricola: boolean, pesoBase: number): number {
  return eixoAgricola ? pesoBase * BONUS_EIXO_AGRICOLA : pesoBase;
}
