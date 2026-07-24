import { PESO_IAPL_SUBBLOCO } from "../../constants/blocos.constants";
import type { IaplCampusInput, IaplInstituicaoResult } from "../../types/qualidadeEficiencia.types";
import { splitLegal } from "./splitLegal";

interface TotaisInstituicao {
  matriculasTecnicos: number;
  matriculasFormacaoProfessores: number;
  matriculasProeja: number;
}

function agregarPorInstituicao(campiInputs: IaplCampusInput[]): Map<number, TotaisInstituicao> {
  const resultado = new Map<number, TotaisInstituicao>();
  for (const input of campiInputs) {
    const atual = resultado.get(input.instituicaoId) ?? {
      matriculasTecnicos: 0,
      matriculasFormacaoProfessores: 0,
      matriculasProeja: 0,
    };
    resultado.set(input.instituicaoId, {
      matriculasTecnicos: atual.matriculasTecnicos + input.matriculasTecnicos,
      matriculasFormacaoProfessores: atual.matriculasFormacaoProfessores + input.matriculasFormacaoProfessores,
      matriculasProeja: atual.matriculasProeja + input.matriculasProeja,
    });
  }
  return resultado;
}

function distribuirPorMatriculas(
  totaisPorInstituicao: Map<number, TotaisInstituicao>,
  matriculasDaInstituicao: (totais: TotaisInstituicao) => number,
  valorCategoria: number,
): Map<number, number> {
  const totalMatriculas = Array.from(totaisPorInstituicao.values()).reduce(
    (total, t) => total + matriculasDaInstituicao(t),
    0,
  );
  const resultado = new Map<number, number>();
  for (const [instituicaoId, totais] of totaisPorInstituicao) {
    const share = totalMatriculas === 0 ? 0 : matriculasDaInstituicao(totais) / totalMatriculas;
    resultado.set(instituicaoId, share * valorCategoria);
  }
  return resultado;
}

/**
 * Divide o sub-bloco IAPL (5,0%) nas três metas legais e distribui cada meta
 * por INSTITUIÇÃO (não por câmpus) proporcionalmente às matrículas de cada
 * categoria — a Matriz CONIF só apura IAPL em nível institucional.
 */
export function calcularBlocoIapl(
  campiInputs: IaplCampusInput[],
  orcamentoTotal: number,
): IaplInstituicaoResult[] {
  if (campiInputs.length === 0) {
    return [];
  }

  const totalIapl = PESO_IAPL_SUBBLOCO * orcamentoTotal;
  const split = splitLegal(totalIapl);
  const totaisPorInstituicao = agregarPorInstituicao(campiInputs);

  const valoresTecnicos = distribuirPorMatriculas(totaisPorInstituicao, (t) => t.matriculasTecnicos, split.tecnicos);
  const valoresFormacao = distribuirPorMatriculas(
    totaisPorInstituicao,
    (t) => t.matriculasFormacaoProfessores,
    split.formacaoProfessores,
  );
  const valoresProeja = distribuirPorMatriculas(totaisPorInstituicao, (t) => t.matriculasProeja, split.proeja);

  return Array.from(totaisPorInstituicao.entries()).map(([instituicaoId, totais]) => {
    const valorTecnicos = valoresTecnicos.get(instituicaoId) ?? 0;
    const valorFormacaoProfessores = valoresFormacao.get(instituicaoId) ?? 0;
    const valorProeja = valoresProeja.get(instituicaoId) ?? 0;
    return {
      instituicaoId,
      matriculasTecnicos: totais.matriculasTecnicos,
      matriculasFormacaoProfessores: totais.matriculasFormacaoProfessores,
      matriculasProeja: totais.matriculasProeja,
      valorTecnicos,
      valorFormacaoProfessores,
      valorProeja,
      valorTotal: valorTecnicos + valorFormacaoProfessores + valorProeja,
    };
  });
}
