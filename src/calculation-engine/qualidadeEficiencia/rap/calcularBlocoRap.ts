import { PESO_RAP_SUBBLOCO } from "../../constants/blocos.constants";
import type { RapInstituicaoResult, RapInput } from "../../types/qualidadeEficiencia.types";
import { bucketizeRap, weightRap } from "./bucketizeRap";

/**
 * Soma Matrículas RAP e Professor Equivalente de todos os câmpus de cada instituição, calcula a
 * razão docente/aluno institucional UMA ÚNICA VEZ a partir dessas somas — nunca por câmpus — e só
 * então enquadra esse valor único em faixa/peso. A Matriz CONIF só apura RAP em nível
 * institucional (fórmula da Figura 9 do livro da Matriz); a razão de duas somas não é igual à
 * combinação de razões já calculadas por câmpus.
 *
 * RAP = Σ Matrículas RAP ÷ Σ Professor Equivalente (Portaria SETEC/MEC nº 51/2018, Art. 5º — ver
 * seção 3.2 de docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md). Ainda usa Matrículas RAP
 * de todas as modalidades (o filtro para RAP Presencial fica para um próximo passo).
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
    const matriculasRap = porCampus.reduce((total, c) => total + c.matriculasRap, 0);
    const professorEquivalente = porCampus.reduce((total, c) => total + c.professorEquivalente, 0);

    const razaoCalculada = professorEquivalente === 0 ? 0 : matriculasRap / professorEquivalente;
    const razaoDocenteAluno = overridesPorInstituicao?.get(instituicaoId) ?? razaoCalculada;
    const band = bucketizeRap(razaoDocenteAluno);
    const peso = weightRap(band);

    return {
      instituicaoId,
      porCampus: porCampus.map(({ campusId, matriculasRap, professorEquivalente }) => ({
        campusId,
        matriculasRap,
        professorEquivalente,
      })),
      matriculasRap,
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
