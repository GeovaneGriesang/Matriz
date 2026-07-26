import { PESO_IEA_SUBBLOCO } from "../../constants/blocos.constants";
import { ESTRATEGIA_FAIXAS_IEA_PADRAO } from "../../constants/qualidadeEficiencia.constants";
import type { EstrategiaFaixasIea, IeaInstituicaoResult, IeaInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeIea } from "./bucketizeIea";
import { weightIea } from "./weightIea";

/**
 * Soma as contagens absolutas (Concluídos/Evadidos/Retidos) de todos os câmpus de cada
 * instituição, calcula o IEA institucional UMA ÚNICA VEZ a partir dessa soma — nunca por câmpus
 * — e só então enquadra esse valor único em faixa/peso. A Matriz CONIF só apura IEA em nível
 * institucional (fórmula da Figura 7 do livro da Matriz); a fórmula do IEA não é linear, então
 * enquadrar por câmpus e somar os ponderados NÃO é equivalente a agregar as contagens primeiro.
 *
 * IEA = C_ciclo + R_ciclo × (C_ciclo / (C_ciclo + Ev_ciclo)), onde C_ciclo/Ev_ciclo/R_ciclo são a
 * proporção de Concluídos/Evadidos/Retidos sobre o total avaliado da instituição (fonte: Guia de
 * Referência Metodológica da PNP — ver seção 3.1 de
 * docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md).
 *
 * `estrategia` escolhe qual das duas tabelas de faixas/pesos enquadra o IEA calculado (ver
 * qualidadeEficiencia.constants.ts) — as duas ficam sempre disponíveis, nenhuma é descartada;
 * "PLANILHA_2026" é o padrão quando omitido. O valor escolhido vai junto no resultado
 * (`estrategia`), para a memória de cálculo sempre indicar de onde veio o enquadramento.
 *
 * `overridesPorInstituicao`, quando informado, substitui o IEA calculado de uma instituição pelo
 * valor fornecido (0–1) antes do enquadramento — usado pelo simulador ("e se o IEA desta
 * instituição fosse X?"). Como IEA só existe em nível de instituição, o override é por
 * instituição, não por câmpus.
 *
 * ATENÇÃO: a agregação de IEA por instituição diverge fortemente do valor oficial para redes com
 * muitos câmpus (erro observado de até ~53pp em IFSUL/IFRS/IFMG/IFSULDEMINAS, contra
 * golden_values_indicadores.csv); validado com confiança só para instituições pequenas como IFAC.
 * Não usar para decisões reais de alocação de recursos sem confirmação da fonte com
 * CONIF/SETEC/PNP. Ver seção 3.1 (atualizada) de Metodologia_Matriz_Orcamentaria_CONIF.md e
 * tests/integration/goldenDataset.test.ts.
 */
export function calcularBlocoIea(
  campiInputs: IeaInput[],
  orcamentoTotal: number,
  overridesPorInstituicao?: Map<number, number>,
  estrategia: EstrategiaFaixasIea = ESTRATEGIA_FAIXAS_IEA_PADRAO,
): IeaInstituicaoResult[] {
  const porInstituicao = new Map<number, IeaInput[]>();
  for (const input of campiInputs) {
    const atual = porInstituicao.get(input.instituicaoId) ?? [];
    atual.push(input);
    porInstituicao.set(input.instituicaoId, atual);
  }

  const instituicaoIds = new Set<number>([...porInstituicao.keys(), ...(overridesPorInstituicao?.keys() ?? [])]);
  if (instituicaoIds.size === 0) {
    return [];
  }

  const agregados = Array.from(instituicaoIds).map((instituicaoId) => {
    const porCampus = porInstituicao.get(instituicaoId) ?? [];
    const concluidos = porCampus.reduce((total, c) => total + c.concluidos, 0);
    const evadidos = porCampus.reduce((total, c) => total + c.evadidos, 0);
    const retidos = porCampus.reduce((total, c) => total + c.retidos, 0);

    const totalCiclo = concluidos + evadidos + retidos;
    const cCiclo = totalCiclo === 0 ? 0 : concluidos / totalCiclo;
    const evCiclo = totalCiclo === 0 ? 0 : evadidos / totalCiclo;
    const rCiclo = totalCiclo === 0 ? 0 : retidos / totalCiclo;
    const valorIeaCalculado = cCiclo + rCiclo * (cCiclo + evCiclo === 0 ? 0 : cCiclo / (cCiclo + evCiclo));

    const valorIea = overridesPorInstituicao?.get(instituicaoId) ?? valorIeaCalculado;
    const band = bucketizeIea(valorIea, estrategia);
    const peso = weightIea(band, estrategia);

    return {
      instituicaoId,
      porCampus: porCampus.map(({ campusId, concluidos, evadidos, retidos }) => ({
        campusId,
        concluidos,
        evadidos,
        retidos,
      })),
      concluidos,
      evadidos,
      retidos,
      cCiclo,
      evCiclo,
      rCiclo,
      valorIea,
      estrategia,
      band,
      peso,
      ponderado: valorIea * peso,
    };
  });

  const somaPonderadosRede = agregados.reduce((total, item) => total + item.ponderado, 0);
  const valorSubBloco = PESO_IEA_SUBBLOCO * orcamentoTotal;

  return agregados.map((item) => {
    const share = somaPonderadosRede === 0 ? 0 : item.ponderado / somaPonderadosRede;
    return {
      ...item,
      somaPonderadosRede,
      share,
      valorReais: share * valorSubBloco,
    };
  });
}
