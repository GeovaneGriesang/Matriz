import { PESO_RAP_SUBBLOCO } from "../../constants/blocos.constants";
import type { RapDistribuicaoResult, RapInput } from "../../types/qualidadeEficiencia.types";
import { calcularRazaoDocenteAluno } from "./calcularRazaoDocenteAluno";
import { bucketizeRap, weightRap } from "./bucketizeRap";

/**
 * Calcula a razão docente/aluno, enquadra em faixa, equaliza (share somando 1.0)
 * e distribui o sub-bloco RAP (2,5%) entre os câmpus informados.
 */
export function calcularBlocoRap(
  campiInputs: RapInput[],
  orcamentoTotal: number,
): RapDistribuicaoResult[] {
  if (campiInputs.length === 0) {
    return [];
  }

  const pesados = campiInputs.map((input) => {
    const razao = calcularRazaoDocenteAluno(input);
    const band = bucketizeRap(razao.razaoDocenteAluno);
    return { ...razao, band, peso: weightRap(band) };
  });

  const somaPesos = pesados.reduce((total, item) => total + item.peso, 0);
  const valorSubBloco = PESO_RAP_SUBBLOCO * orcamentoTotal;

  return pesados.map((item) => {
    const share = somaPesos === 0 ? 0 : item.peso / somaPesos;
    return {
      campusId: item.campusId,
      docentesEquivalentes: item.docentesEquivalentes,
      razaoDocenteAluno: item.razaoDocenteAluno,
      band: item.band,
      peso: item.peso,
      share,
      valorReais: share * valorSubBloco,
    };
  });
}
