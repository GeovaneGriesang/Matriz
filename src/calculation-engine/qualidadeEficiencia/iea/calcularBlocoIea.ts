import { PESO_IEA_SUBBLOCO } from "../../constants/blocos.constants";
import type { IeaDistribuicaoResult, IeaInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeIea } from "./bucketizeIea";
import { weightIea } from "./weightIea";

/**
 * Enquadra, pondera (IEA Ponderado = IEA × Peso), equaliza (share somando 1.0,
 * IEA Equalizado = IEA Ponderado / Σ IEA Ponderado) e distribui o sub-bloco IEA
 * (2,5%) entre os câmpus informados — fórmula da Figura 7 do livro da Matriz.
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
    const peso = weightIea(band);
    return { campusId: input.campusId, valorIea: input.valorIea, band, peso, ponderado: input.valorIea * peso };
  });

  const somaPonderados = pesados.reduce((total, item) => total + item.ponderado, 0);
  const valorSubBloco = PESO_IEA_SUBBLOCO * orcamentoTotal;

  return pesados.map((item) => {
    const share = somaPonderados === 0 ? 0 : item.ponderado / somaPonderados;
    return {
      campusId: item.campusId,
      valorIea: item.valorIea,
      band: item.band,
      peso: item.peso,
      ponderado: item.ponderado,
      share,
      valorReais: share * valorSubBloco,
    };
  });
}
