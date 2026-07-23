import { PESO_RAP_SUBBLOCO } from "../../constants/blocos.constants";
import type { RapDistribuicaoResult, RapInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeRap, weightRap } from "./bucketizeRap";

/**
 * Enquadra a razão docente/aluno (já calculada pela PNP) em faixa, equaliza
 * (share somando 1.0) e distribui o sub-bloco RAP (2,5%) entre os câmpus
 * informados.
 */
export function calcularBlocoRap(
  campiInputs: RapInput[],
  orcamentoTotal: number,
): RapDistribuicaoResult[] {
  if (campiInputs.length === 0) {
    return [];
  }

  const pesados = campiInputs.map((input) => {
    const band = bucketizeRap(input.razaoDocenteAluno);
    return { campusId: input.campusId, razaoDocenteAluno: input.razaoDocenteAluno, band, peso: weightRap(band) };
  });

  const somaPesos = pesados.reduce((total, item) => total + item.peso, 0);
  const valorSubBloco = PESO_RAP_SUBBLOCO * orcamentoTotal;

  return pesados.map((item) => {
    const share = somaPesos === 0 ? 0 : item.peso / somaPesos;
    return {
      campusId: item.campusId,
      razaoDocenteAluno: item.razaoDocenteAluno,
      band: item.band,
      peso: item.peso,
      share,
      valorReais: share * valorSubBloco,
    };
  });
}
