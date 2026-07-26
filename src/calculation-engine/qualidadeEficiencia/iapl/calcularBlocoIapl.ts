import { PESO_IAPL_SUBBLOCO } from "../../constants/blocos.constants";
import type { IaplCampusInput, IaplCategoriaResult, IaplInstituicaoResult } from "../../types/qualidadeEficiencia.types";
import { splitLegal } from "./splitLegal";
import { pesoIaplFormacaoProfessores, pesoIaplProeja, pesoIaplTecnicos } from "./bucketizeIapl";

interface TotaisInstituicao {
  matriculasTecnicos: number;
  matriculasFormacaoProfessores: number;
  matriculasProeja: number;
  matriculasGeral: number;
}

function agregarPorInstituicao(campiInputs: IaplCampusInput[]): Map<number, TotaisInstituicao> {
  const resultado = new Map<number, TotaisInstituicao>();
  for (const input of campiInputs) {
    const atual = resultado.get(input.instituicaoId) ?? {
      matriculasTecnicos: 0,
      matriculasFormacaoProfessores: 0,
      matriculasProeja: 0,
      matriculasGeral: 0,
    };
    resultado.set(input.instituicaoId, {
      matriculasTecnicos: atual.matriculasTecnicos + input.matriculasTecnicos,
      matriculasFormacaoProfessores: atual.matriculasFormacaoProfessores + input.matriculasFormacaoProfessores,
      matriculasProeja: atual.matriculasProeja + input.matriculasProeja,
      matriculasGeral: atual.matriculasGeral + input.matriculasGeral,
    });
  }
  return resultado;
}

/**
 * Enquadra o %ME de uma categoria (Técnicos/Formação de Professores/Proeja) de cada instituição na
 * respectiva tabela de faixas/pesos (seção 2.1 da metodologia), pondera (%ME × peso) e distribui o
 * valor da categoria proporcionalmente a esse ponderado — mesmo padrão de IEA/RAP. Uma instituição
 * que não atinge nenhum piso legal (%ME abaixo do primeiro degrau) recebe peso 0 e não participa
 * do rateio dessa categoria, mesmo tendo matrículas nela.
 */
function calcularCategoria(
  totaisPorInstituicao: Map<number, TotaisInstituicao>,
  matriculasDaCategoria: (totais: TotaisInstituicao) => number,
  peso: (percentualMe: number) => number,
  valorCategoriaRede: number,
): Map<number, IaplCategoriaResult> {
  const agregados = Array.from(totaisPorInstituicao.entries()).map(([instituicaoId, totais]) => {
    const matriculas = matriculasDaCategoria(totais);
    const matriculasGeral = totais.matriculasGeral;
    const percentualMe = matriculasGeral === 0 ? 0 : matriculas / matriculasGeral;
    const pesoCategoria = peso(percentualMe);
    return {
      instituicaoId,
      matriculas,
      matriculasGeral,
      percentualMe,
      peso: pesoCategoria,
      ponderado: percentualMe * pesoCategoria,
    };
  });

  const somaPonderadosRede = agregados.reduce((total, item) => total + item.ponderado, 0);

  const resultado = new Map<number, IaplCategoriaResult>();
  for (const item of agregados) {
    const share = somaPonderadosRede === 0 ? 0 : item.ponderado / somaPonderadosRede;
    resultado.set(item.instituicaoId, {
      matriculas: item.matriculas,
      matriculasGeral: item.matriculasGeral,
      percentualMe: item.percentualMe,
      peso: item.peso,
      ponderado: item.ponderado,
      somaPonderadosRede,
      share,
      valorReais: share * valorCategoriaRede,
    });
  }
  return resultado;
}

/**
 * Divide o sub-bloco IAPL (5,0%) nas três metas legais (70% Técnicos / 20% Formação de
 * Professores / 10% Proeja) e, dentro de cada meta, distribui proporcionalmente ao %ME da
 * instituição enquadrado em faixa de peso — nunca proporcionalmente à matrícula bruta da
 * categoria (isso ignoraria se a instituição atinge ou não o piso legal).
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

  const tecnicos = calcularCategoria(totaisPorInstituicao, (t) => t.matriculasTecnicos, pesoIaplTecnicos, split.tecnicos);
  const formacaoProfessores = calcularCategoria(
    totaisPorInstituicao,
    (t) => t.matriculasFormacaoProfessores,
    pesoIaplFormacaoProfessores,
    split.formacaoProfessores,
  );
  const proeja = calcularCategoria(totaisPorInstituicao, (t) => t.matriculasProeja, pesoIaplProeja, split.proeja);

  return Array.from(totaisPorInstituicao.keys()).map((instituicaoId) => {
    const tecnicosD = tecnicos.get(instituicaoId)!;
    const formacaoD = formacaoProfessores.get(instituicaoId)!;
    const proejaD = proeja.get(instituicaoId)!;
    return {
      instituicaoId,
      tecnicos: tecnicosD,
      formacaoProfessores: formacaoD,
      proeja: proejaD,
      valorTotal: tecnicosD.valorReais + formacaoD.valorReais + proejaD.valorReais,
    };
  });
}
