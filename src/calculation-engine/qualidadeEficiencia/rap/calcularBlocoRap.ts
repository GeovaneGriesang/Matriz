import { PESO_RAP_SUBBLOCO } from "../../constants/blocos.constants";
import type { RapDistribuicaoResult, RapInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeRap, weightRap } from "./bucketizeRap";

/**
 * Enquadra a razão docente/aluno (já calculada pela PNP) em faixa, pondera
 * (RAP Ponderado = RAP × Peso), equaliza (share somando 1.0, RAP Equalizado =
 * RAP Ponderado / Σ RAP Ponderado) e distribui o sub-bloco RAP (2,5%) entre os
 * câmpus informados — fórmula da Figura 9 do livro da Matriz.
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
    const peso = weightRap(band);
    return {
      campusId: input.campusId,
      razaoDocenteAluno: input.razaoDocenteAluno,
      band,
      peso,
      ponderado: input.razaoDocenteAluno * peso,
    };
  });

  const somaPonderados = pesados.reduce((total, item) => total + item.ponderado, 0);
  const valorSubBloco = PESO_RAP_SUBBLOCO * orcamentoTotal;

  return pesados.map((item) => {
    const share = somaPonderados === 0 ? 0 : item.ponderado / somaPonderados;
    return {
      campusId: item.campusId,
      razaoDocenteAluno: item.razaoDocenteAluno,
      band: item.band,
      peso: item.peso,
      ponderado: item.ponderado,
      share,
      valorReais: share * valorSubBloco,
    };
  });
}
