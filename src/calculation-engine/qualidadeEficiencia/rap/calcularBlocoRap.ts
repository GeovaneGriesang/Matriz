import { PESO_RAP_SUBBLOCO } from "../../constants/blocos.constants";
import type { RapInstituicaoResult, RapInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeRap, weightRap } from "./bucketizeRap";

/**
 * Soma matrículas presenciais e Professor Equivalente de todos os câmpus de cada instituição,
 * calcula a razão docente/aluno institucional UMA ÚNICA VEZ a partir dessas somas — nunca por
 * câmpus — e só então enquadra esse valor único em faixa/peso. A Matriz CONIF só apura RAP em
 * nível institucional (fórmula da Figura 9 do livro da Matriz); a razão de duas somas não é igual
 * à combinação de razões já calculadas por câmpus.
 *
 * RAP Presencial = Σ matrículas presenciais ÷ Σ Professor Equivalente (Portaria SETEC/MEC nº
 * 51/2018, Art. 5º — ver seção 3.2 de docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md).
 *
 * APROXIMAÇÃO: o numerador oficial é a Matrícula-equivalente presencial (ponderada por Fator de
 * Esforço de Curso, seção 3.2.1 da metodologia); como essa granularidade não está disponível hoje,
 * usamos a matrícula bruta presencial de `TaxaEvasao.csv` (filtrada por
 * ModalidadeEnsino = "Educação Presencial") como aproximação. Erro esperado entre +0,9% e +53%
 * dependendo da instituição, testado em golden_values_indicadores.csv. Ver seção 9 de
 * Metodologia_Matriz_Orcamentaria_CONIF.md. O denominador (Professor Equivalente) já está correto
 * e não precisa de ajuste. Não usar fatores de esforço de curso aqui para "melhorar" a
 * aproximação — isso é um próximo passo, não deste cálculo.
 *
 * `overridesPorInstituicao`, quando informado, substitui a razão calculada de uma instituição pelo
 * valor fornecido antes do enquadramento — usado pelo simulador ("e se o RAP desta instituição
 * fosse X?"). Como RAP só existe em nível de instituição, o override é por instituição, não por
 * câmpus.
 */
export function calcularBlocoRap(
  campiInputs: RapInput[],
  orcamentoTotal: number,
  overridesPorInstituicao?: Map<number, number>,
): RapInstituicaoResult[] {
  const porInstituicao = new Map<number, RapInput[]>();
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
    const matriculasPresenciais = porCampus.reduce((total, c) => total + c.matriculasPresenciais, 0);
    const professorEquivalente = porCampus.reduce((total, c) => total + c.professorEquivalente, 0);

    const razaoCalculada = professorEquivalente === 0 ? 0 : matriculasPresenciais / professorEquivalente;
    const razaoDocenteAluno = overridesPorInstituicao?.get(instituicaoId) ?? razaoCalculada;
    const band = bucketizeRap(razaoDocenteAluno);
    const peso = weightRap(band);

    return {
      instituicaoId,
      porCampus: porCampus.map(({ campusId, matriculasPresenciais, professorEquivalente }) => ({
        campusId,
        matriculasPresenciais,
        professorEquivalente,
      })),
      matriculasPresenciais,
      professorEquivalente,
      razaoDocenteAluno,
      band,
      peso,
      ponderado: razaoDocenteAluno * peso,
    };
  });

  const somaPonderadosRede = agregados.reduce((total, item) => total + item.ponderado, 0);
  const valorSubBloco = PESO_RAP_SUBBLOCO * orcamentoTotal;

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
