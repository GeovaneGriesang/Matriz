import { PESO_IEA_SUBBLOCO } from "../../constants/blocos.constants";
import type { IeaDistribuicaoResult, IeaInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeIea } from "./bucketizeIea";
import { weightIea } from "./weightIea";

/**
 * Enquadra, pondera, equaliza (share somando 1.0) e distribui o sub-bloco IEA (2,5%)
 * entre os câmpus informados.
 */
export function calcularBlocoIea(
  campiInputs: IeaInput[],
  orcamentoTotal: number,
): IeaDistribuicaoResult[] {
  if (campiInputs.length === 0) {
    return [];
  }

  const pesados = campiInputs.map((input) => {
    const band = bucketizeIea(input.valorIea);
    return { campusId: input.campusId, band, peso: weightIea(band) };
  });

  const somaPesos = pesados.reduce((total, item) => total + item.peso, 0);
  const valorSubBloco = PESO_IEA_SUBBLOCO * orcamentoTotal;

  return pesados.map((item) => {
    const share = somaPesos === 0 ? 0 : item.peso / somaPesos;
    return {
      campusId: item.campusId,
      band: item.band,
      peso: item.peso,
      share,
      valorReais: share * valorSubBloco,
    };
  });
}
