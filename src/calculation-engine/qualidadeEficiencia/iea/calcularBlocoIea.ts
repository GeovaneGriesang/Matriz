import { PESO_IEA_SUBBLOCO } from "../../constants/blocos.constants";
import type { IeaInstituicaoResult, IeaInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeIea } from "./bucketizeIea";
import { weightIea } from "./weightIea";

/**
 * Enquadra e pondera (IEA Ponderado = IEA × Peso) cada câmpus, mas equaliza
 * (share) e distribui o sub-bloco IEA (2,5%) por INSTITUIÇÃO, não por câmpus —
 * a Matriz CONIF só apura IEA em nível institucional (fórmula da Figura 7 do
 * livro da Matriz, aplicada sobre a soma dos câmpus da instituição).
 */
export function calcularBlocoIea(
  campiInputs: IeaInput[],
  orcamentoTotal: number,
): IeaInstituicaoResult[] {
  if (campiInputs.length === 0) {
    return [];
  }

  const pesados = campiInputs.map((input) => {
    const band = bucketizeIea(input.valorIea);
    const peso = weightIea(band);
    return {
      campusId: input.campusId,
      instituicaoId: input.instituicaoId,
      valorIea: input.valorIea,
      band,
      peso,
      ponderado: input.valorIea * peso,
    };
  });

  const somaPonderadosRede = pesados.reduce((total, item) => total + item.ponderado, 0);
  const valorSubBloco = PESO_IEA_SUBBLOCO * orcamentoTotal;

  const porInstituicao = new Map<number, typeof pesados>();
  for (const item of pesados) {
    const atual = porInstituicao.get(item.instituicaoId) ?? [];
    atual.push(item);
    porInstituicao.set(item.instituicaoId, atual);
  }

  return Array.from(porInstituicao.entries()).map(([instituicaoId, porCampus]) => {
    const ponderadoInstituicao = porCampus.reduce((total, item) => total + item.ponderado, 0);
    const share = somaPonderadosRede === 0 ? 0 : ponderadoInstituicao / somaPonderadosRede;
    return {
      instituicaoId,
      porCampus: porCampus.map(({ campusId, valorIea, band, peso, ponderado }) => ({
        campusId,
        valorIea,
        band,
        peso,
        ponderado,
      })),
      ponderadoInstituicao,
      somaPonderadosRede,
      share,
      valorReais: share * valorSubBloco,
    };
  });
}
