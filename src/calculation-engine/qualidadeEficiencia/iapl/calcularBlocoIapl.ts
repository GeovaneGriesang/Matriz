import { PESO_IAPL_SUBBLOCO } from "../../constants/blocos.constants";
import type { IaplCampusInput, IaplDistribuicaoResult } from "../../types/qualidadeEficiencia.types";
import { splitLegal } from "./splitLegal";

function distribuirPorMatriculas(
  campiInputs: IaplCampusInput[],
  matriculasPorCampus: (input: IaplCampusInput) => number,
  valorCategoria: number,
): Map<number, number> {
  const totalMatriculas = campiInputs.reduce((total, i) => total + matriculasPorCampus(i), 0);
  const resultado = new Map<number, number>();
  for (const input of campiInputs) {
    const share = totalMatriculas === 0 ? 0 : matriculasPorCampus(input) / totalMatriculas;
    resultado.set(input.campusId, share * valorCategoria);
  }
  return resultado;
}

/**
 * Divide o sub-bloco IAPL (5,0%) nas três metas legais e distribui cada meta
 * entre os câmpus proporcionalmente às matrículas de cada categoria.
 */
export function calcularBlocoIapl(
  campiInputs: IaplCampusInput[],
  orcamentoTotal: number,
): IaplDistribuicaoResult[] {
  if (campiInputs.length === 0) {
    return [];
  }

  const totalIapl = PESO_IAPL_SUBBLOCO * orcamentoTotal;
  const split = splitLegal(totalIapl);

  const valoresTecnicos = distribuirPorMatriculas(campiInputs, (i) => i.matriculasTecnicos, split.tecnicos);
  const valoresFormacao = distribuirPorMatriculas(
    campiInputs,
    (i) => i.matriculasFormacaoProfessores,
    split.formacaoProfessores,
  );
  const valoresProeja = distribuirPorMatriculas(campiInputs, (i) => i.matriculasProeja, split.proeja);

  return campiInputs.map((input) => {
    const valorTecnicos = valoresTecnicos.get(input.campusId) ?? 0;
    const valorFormacaoProfessores = valoresFormacao.get(input.campusId) ?? 0;
    const valorProeja = valoresProeja.get(input.campusId) ?? 0;
    return {
      campusId: input.campusId,
      valorTecnicos,
      valorFormacaoProfessores,
      valorProeja,
      valorTotal: valorTecnicos + valorFormacaoProfessores + valorProeja,
    };
  });
}
