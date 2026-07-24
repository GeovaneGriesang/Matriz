import { PESO_RAP_SUBBLOCO } from "../../constants/blocos.constants";
import type { RapInstituicaoResult, RapInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeRap, weightRap } from "./bucketizeRap";

/**
 * Enquadra e pondera (RAP Ponderado = RAP × Peso) cada câmpus, mas equaliza
 * (share) e distribui o sub-bloco RAP (2,5%) por INSTITUIÇÃO, não por câmpus —
 * a Matriz CONIF só apura RAP em nível institucional (fórmula da Figura 9 do
 * livro da Matriz, aplicada sobre a soma dos câmpus da instituição).
 */
export function calcularBlocoRap(
  campiInputs: RapInput[],
  orcamentoTotal: number,
): RapInstituicaoResult[] {
  if (campiInputs.length === 0) {
    return [];
  }

  const pesados = campiInputs.map((input) => {
    const band = bucketizeRap(input.razaoDocenteAluno);
    const peso = weightRap(band);
    return {
      campusId: input.campusId,
      instituicaoId: input.instituicaoId,
      razaoDocenteAluno: input.razaoDocenteAluno,
      band,
      peso,
      ponderado: input.razaoDocenteAluno * peso,
    };
  });

  const somaPonderadosRede = pesados.reduce((total, item) => total + item.ponderado, 0);
  const valorSubBloco = PESO_RAP_SUBBLOCO * orcamentoTotal;

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
      porCampus: porCampus.map(({ campusId, razaoDocenteAluno, band, peso, ponderado }) => ({
        campusId,
        razaoDocenteAluno,
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
