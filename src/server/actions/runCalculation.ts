"use server";

import { prisma } from "@/server/db/prisma";
import { blocoFuncionamento, type FuncionamentoInput } from "@/calculation-engine/blocoFuncionamento";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { blocoQualidadeEficiencia } from "@/calculation-engine/blocoQualidadeEficiencia";
import { calcularBlocoIea } from "@/calculation-engine/qualidadeEficiencia/iea/calcularBlocoIea";
import { bucketizeIea } from "@/calculation-engine/qualidadeEficiencia/iea/bucketizeIea";
import { weightIea } from "@/calculation-engine/qualidadeEficiencia/iea/weightIea";
import { calcularBlocoRap } from "@/calculation-engine/qualidadeEficiencia/rap/calcularBlocoRap";
import { bucketizeRap, weightRap } from "@/calculation-engine/qualidadeEficiencia/rap/bucketizeRap";
import { calcularBlocoIapl } from "@/calculation-engine/qualidadeEficiencia/iapl/calcularBlocoIapl";
import * as qualidadeEficienciaConstants from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import { IAPL_SPLIT } from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import * as blocosConstants from "@/calculation-engine/constants/blocos.constants";
import {
  PESO_BLOCO_FUNCIONAMENTO,
  PESO_BLOCO_REITORIAS,
  PESO_IEA_SUBBLOCO,
  PESO_RAP_SUBBLOCO,
  PESO_IAPL_SUBBLOCO,
} from "@/calculation-engine/constants/blocos.constants";
import type {
  IaplCampusInput,
  IeaInput,
  RapInput,
} from "@/calculation-engine/types/qualidadeEficiencia.types";

export interface CampusOverride {
  matriculaPonderada?: number;
  /** Escala 0-100, igual ao valor bruto exportado pela PNP (é dividido por 100 internamente, como o dado real). */
  valorIeaPercentual?: number;
  razaoDocenteAluno?: number;
  matriculasTecnicos?: number;
  matriculasFormacaoProfessores?: number;
  matriculasProeja?: number;
}

export interface RunCalculationInput {
  /** Instituição (autarquia) para a qual este cálculo é feito — escopa todas as consultas de fatos. */
  instituicaoId: number;
  /**
   * `orcamentoTotal` é o Custeio (Ação 20RL) já específico desta instituição
   * (ex.: o valor aprovado na LOA para o IFSul), não o total da Rede Federal.
   */
  orcamentoTotal: number;
  /** Ano de referência (ano da PNP) cujos fatos já ingeridos alimentam o cálculo. */
  ano: number;
  /**
   * Ano do orçamento oficial ao qual este cálculo se refere (só para `origem: "OFICIAL"`).
   * A regra da PNP é que o orçamento de um ano usa dados de dois anos antes — por isso
   * `anoOrcamento` (ex.: 2027) e `ano`/ano de referência PNP (ex.: 2025) são diferentes.
   * Guardado só para exibição/auditoria; quem calcula o `ano` de referência é o chamador.
   */
  anoOrcamento?: number;
  /** "OFICIAL" trava o número usado na tela de Consulta; "SIMULACAO" (padrão) é um cenário ad-hoc. */
  origem?: "SIMULACAO" | "OFICIAL";
  /**
   * Sobrescreve, só para este cálculo (nunca grava em `FatoIndicador`), indicadores de câmpus
   * específicos — usado pelo simulador para testar cenários ("e se o RAP desse câmpus fosse X?").
   */
  overridesPorUnidade?: Record<number, CampusOverride>;
}

export interface RunCalculationResult {
  runId: number;
  unidadeCount: number;
}

const MEDIDA_MATRICULA_EQUIVALENTE_GERAL = "Matrícula Equivalente | Geral";
const MEDIDA_INDICE_EFICIENCIA_ACADEMICA = "Eficiência Acadêmica | Índice de Eficiência Acadêmica %";
const MEDIDA_RAP = "RAP | RAP";

const IAPL_CAMPO_POR_MEDIDA = {
  "Matrícula Equivalente | Técnicos": "matriculasTecnicos",
  "Matrícula Equivalente | Formação de Professores": "matriculasFormacaoProfessores",
  "Matrícula Equivalente | Proeja": "matriculasProeja",
} as const satisfies Record<string, keyof Omit<IaplCampusInput, "campusId">>;

function aplicarOverrideFuncionamento(
  inputs: FuncionamentoInput[],
  overrides: Record<number, CampusOverride>,
): FuncionamentoInput[] {
  const resultado = [...inputs];
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    if (override.matriculaPonderada === undefined) continue;
    const unidadeId = Number(unidadeIdStr);
    const item: FuncionamentoInput = { campusId: unidadeId, matriculaPonderada: override.matriculaPonderada };
    const index = resultado.findIndex((i) => i.campusId === unidadeId);
    if (index === -1) resultado.push(item);
    else resultado[index] = item;
  }
  return resultado;
}

function aplicarOverrideIea(inputs: IeaInput[], overrides: Record<number, CampusOverride>): IeaInput[] {
  const resultado = [...inputs];
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    if (override.valorIeaPercentual === undefined) continue;
    const unidadeId = Number(unidadeIdStr);
    const item: IeaInput = { campusId: unidadeId, valorIea: override.valorIeaPercentual / 100 };
    const index = resultado.findIndex((i) => i.campusId === unidadeId);
    if (index === -1) resultado.push(item);
    else resultado[index] = item;
  }
  return resultado;
}

function aplicarOverrideRap(inputs: RapInput[], overrides: Record<number, CampusOverride>): RapInput[] {
  const resultado = [...inputs];
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    if (override.razaoDocenteAluno === undefined) continue;
    const unidadeId = Number(unidadeIdStr);
    const item: RapInput = { campusId: unidadeId, razaoDocenteAluno: override.razaoDocenteAluno };
    const index = resultado.findIndex((i) => i.campusId === unidadeId);
    if (index === -1) resultado.push(item);
    else resultado[index] = item;
  }
  return resultado;
}

function aplicarOverrideIapl(
  mapa: Map<number, IaplCampusInput>,
  overrides: Record<number, CampusOverride>,
): Map<number, IaplCampusInput> {
  const resultado = new Map(mapa);
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    const temCampoIapl =
      override.matriculasTecnicos !== undefined ||
      override.matriculasFormacaoProfessores !== undefined ||
      override.matriculasProeja !== undefined;
    if (!temCampoIapl) continue;
    const unidadeId = Number(unidadeIdStr);
    const atual = resultado.get(unidadeId) ?? {
      campusId: unidadeId,
      matriculasTecnicos: 0,
      matriculasFormacaoProfessores: 0,
      matriculasProeja: 0,
    };
    resultado.set(unidadeId, {
      campusId: unidadeId,
      matriculasTecnicos: override.matriculasTecnicos ?? atual.matriculasTecnicos,
      matriculasFormacaoProfessores: override.matriculasFormacaoProfessores ?? atual.matriculasFormacaoProfessores,
      matriculasProeja: override.matriculasProeja ?? atual.matriculasProeja,
    });
  }
  return resultado;
}

/**
 * Executa um run de cálculo completo (Bloco Funcionamento + Reitorias + Qualidade
 * e Eficiência) sobre os fatos já ingeridos (`FatoIndicador`) para o ano
 * informado, e persiste o resultado com um snapshot dos parâmetros (constantes
 * usados, overrides aplicados) para auditoria futura. Cada linha de resultado
 * também grava um `detalhe` com a "memória de cálculo" (share, band/peso,
 * totais de rede) usada para chegar naquele valor — fins didáticos.
 *
 * A Matrícula Ponderada do Bloco de Funcionamento usa a Matrícula Equivalente
 * oficial da PNP (DadosGerais, medida "Matrícula Equivalente | Geral") somada
 * por unidade — a PNP já aplica sua própria metodologia de peso, então não
 * reimplementamos um cálculo por matrícula individual.
 *
 * Importante: `input.ano` é sempre o ano de referência da PNP consultado em
 * `FatoIndicador` — NÃO é necessariamente o ano do orçamento. Para a
 * distribuição oficial, o orçamento de um ano usa dados da PNP de dois anos
 * antes (ex.: orçamento de 2027 usa dados de 2025); é responsabilidade de
 * quem chama esta função (ver `calcularDistribuicaoOficialAction`) já passar
 * o `ano` correto (defasado) e, para runs oficiais, também `anoOrcamento`
 * (o ano do orçamento em si) só para fins de exibição.
 *
 * Nota: o valor de Reitorias é armazenado com `campusId = null` e o id da
 * instituição codificado na `metrica` (`valorReais_autarquia_<id>`), já que
 * `CalculationResult` não tem uma coluna dedicada para instituição na M1.
 */
export async function runCalculation(input: RunCalculationInput): Promise<RunCalculationResult> {
  const overrides = input.overridesPorUnidade ?? {};

  const mateqPorUnidade = await prisma.fatoIndicador.groupBy({
    by: ["unidadeId"],
    where: {
      fileType: "DADOS_GERAIS",
      medida: MEDIDA_MATRICULA_EQUIVALENTE_GERAL,
      ano: input.ano,
      instituicaoId: input.instituicaoId,
      unidadeId: { not: null },
    },
    _sum: { valor: true },
  });

  const funcionamentoInputs = aplicarOverrideFuncionamento(
    mateqPorUnidade
      .filter((f) => f.unidadeId !== null)
      .map((f) => ({
        campusId: f.unidadeId as number,
        matriculaPonderada: Number(f._sum.valor ?? 0),
      })),
    overrides,
  );

  const ieaFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "EFICIENCIA_ACADEMICA",
      medida: MEDIDA_INDICE_EFICIENCIA_ACADEMICA,
      ano: input.ano,
      instituicaoId: input.instituicaoId,
      unidadeId: { not: null },
    },
  });
  // PNP entrega o IEA em escala 0-100%; bucketizeIea espera [0, 1].
  const ieaInputs = aplicarOverrideIea(
    ieaFatos.map((f) => ({
      campusId: f.unidadeId as number,
      valorIea: Number(f.valor) / 100,
    })),
    overrides,
  );

  const rapFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
      medida: MEDIDA_RAP,
      ano: input.ano,
      instituicaoId: input.instituicaoId,
      unidadeId: { not: null },
    },
  });
  const rapInputs = aplicarOverrideRap(
    rapFatos.map((f) => ({
      campusId: f.unidadeId as number,
      razaoDocenteAluno: Number(f.valor),
    })),
    overrides,
  );

  const iaplFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "PERCENTUAIS_LEGAIS",
      medida: { in: Object.keys(IAPL_CAMPO_POR_MEDIDA) },
      ano: input.ano,
      instituicaoId: input.instituicaoId,
      unidadeId: { not: null },
    },
  });
  let iaplPorUnidade = new Map<number, IaplCampusInput>();
  for (const fato of iaplFatos) {
    const unidadeId = fato.unidadeId as number;
    const atual = iaplPorUnidade.get(unidadeId) ?? {
      campusId: unidadeId,
      matriculasTecnicos: 0,
      matriculasFormacaoProfessores: 0,
      matriculasProeja: 0,
    };
    const campo = IAPL_CAMPO_POR_MEDIDA[fato.medida as keyof typeof IAPL_CAMPO_POR_MEDIDA];
    atual[campo] += Number(fato.valor);
    iaplPorUnidade.set(unidadeId, atual);
  }
  iaplPorUnidade = aplicarOverrideIapl(iaplPorUnidade, overrides);
  const iaplInputs = Array.from(iaplPorUnidade.values());

  // ---- totais de rede usados só para a "memória de cálculo" (detalhe) ----
  const totalMatriculaPonderadaRede = funcionamentoInputs.reduce((s, i) => s + i.matriculaPonderada, 0);
  const somaPonderadosIeaRede = ieaInputs.reduce((s, i) => s + i.valorIea * weightIea(bucketizeIea(i.valorIea)), 0);
  const somaPonderadosRapRede = rapInputs.reduce(
    (s, i) => s + i.razaoDocenteAluno * weightRap(bucketizeRap(i.razaoDocenteAluno)),
    0,
  );
  const totalMatriculasTecnicosRede = iaplInputs.reduce((s, i) => s + i.matriculasTecnicos, 0);
  const totalMatriculasFormacaoRede = iaplInputs.reduce((s, i) => s + i.matriculasFormacaoProfessores, 0);
  const totalMatriculasProejaRede = iaplInputs.reduce((s, i) => s + i.matriculasProeja, 0);

  const funcionamento = blocoFuncionamento(funcionamentoInputs, input.orcamentoTotal);
  const reitoria = blocoReitorias(input.instituicaoId, input.orcamentoTotal);
  const qualidadeEficiencia = blocoQualidadeEficiencia(ieaInputs, rapInputs, iaplInputs, input.orcamentoTotal);

  // Recalculados isoladamente (mesmas funções puras, mesmos inputs finais) só para expor
  // band/peso/share por sub-bloco na memória de cálculo — blocoQualidadeEficiencia não
  // expõe esse detalhe, só o valor combinado.
  const ieaDetalhePorCampus = new Map(calcularBlocoIea(ieaInputs, input.orcamentoTotal).map((d) => [d.campusId, d]));
  const rapDetalhePorCampus = new Map(calcularBlocoRap(rapInputs, input.orcamentoTotal).map((d) => [d.campusId, d]));
  const iaplDetalhePorCampus = new Map(
    calcularBlocoIapl(iaplInputs, input.orcamentoTotal).map((d) => [d.campusId, d]),
  );
  const iaplInputPorCampus = new Map(iaplInputs.map((i) => [i.campusId, i]));

  const parametersSnapshot = {
    instituicaoId: input.instituicaoId,
    ano: input.ano,
    anoOrcamento: input.anoOrcamento ?? null,
    orcamentoTotal: input.orcamentoTotal,
    overridesPorUnidade: overrides,
    qualidadeEficiencia: qualidadeEficienciaConstants,
    blocos: blocosConstants,
  };

  const run = await prisma.calculationRun.create({
    data: {
      status: "RUNNING",
      origem: input.origem ?? "SIMULACAO",
      ingestionBatchIds: [],
      parametersSnapshot: JSON.parse(JSON.stringify(parametersSnapshot)),
    },
  });

  const resultados = [
    ...funcionamento.map((f) => ({
      runId: run.id,
      campusId: f.campusId,
      bloco: "FUNCIONAMENTO" as const,
      metrica: "valorReais",
      valor: f.valorReais,
      detalhe: {
        matriculaPonderadaCampus: f.totalMatriculaPonderada,
        totalMatriculaPonderadaRede,
        share: f.share,
        pesoBloco: PESO_BLOCO_FUNCIONAMENTO,
        valorBlocoRede: PESO_BLOCO_FUNCIONAMENTO * input.orcamentoTotal,
        valorReais: f.valorReais,
      },
    })),
    {
      runId: run.id,
      campusId: null,
      bloco: "REITORIAS" as const,
      metrica: `valorReais_autarquia_${reitoria.autarquiaId}`,
      valor: reitoria.valorReais,
      detalhe: {
        pesoBloco: PESO_BLOCO_REITORIAS,
        valorBlocoRede: PESO_BLOCO_REITORIAS * input.orcamentoTotal,
        valorReais: reitoria.valorReais,
      },
    },
    ...qualidadeEficiencia.map((q) => {
      const ieaD = ieaDetalhePorCampus.get(q.campusId);
      const rapD = rapDetalhePorCampus.get(q.campusId);
      const iaplD = iaplDetalhePorCampus.get(q.campusId);
      const iaplInput = iaplInputPorCampus.get(q.campusId);

      return {
        runId: run.id,
        campusId: q.campusId,
        bloco: "QUALIDADE_EFICIENCIA" as const,
        metrica: "valorReais",
        valor: q.valorTotal,
        detalhe: {
          iea: ieaD
            ? {
                valorIea: ieaD.valorIea,
                band: ieaD.band,
                peso: ieaD.peso,
                ponderado: ieaD.ponderado,
                somaPonderadosRede: somaPonderadosIeaRede,
                share: ieaD.share,
                pesoSubBloco: PESO_IEA_SUBBLOCO,
                valorSubBlocoRede: PESO_IEA_SUBBLOCO * input.orcamentoTotal,
                valorReais: ieaD.valorReais,
              }
            : null,
          rap: rapD
            ? {
                razaoDocenteAluno: rapD.razaoDocenteAluno,
                band: rapD.band,
                peso: rapD.peso,
                ponderado: rapD.ponderado,
                somaPonderadosRede: somaPonderadosRapRede,
                share: rapD.share,
                pesoSubBloco: PESO_RAP_SUBBLOCO,
                valorSubBlocoRede: PESO_RAP_SUBBLOCO * input.orcamentoTotal,
                valorReais: rapD.valorReais,
              }
            : null,
          iapl:
            iaplD && iaplInput
              ? {
                  tecnicos: {
                    matriculasCampus: iaplInput.matriculasTecnicos,
                    totalMatriculasRede: totalMatriculasTecnicosRede,
                    share:
                      totalMatriculasTecnicosRede === 0
                        ? 0
                        : iaplInput.matriculasTecnicos / totalMatriculasTecnicosRede,
                    valorCategoriaRede: PESO_IAPL_SUBBLOCO * input.orcamentoTotal * IAPL_SPLIT.CURSOS_TECNICOS,
                    valorReais: iaplD.valorTecnicos,
                  },
                  formacaoProfessores: {
                    matriculasCampus: iaplInput.matriculasFormacaoProfessores,
                    totalMatriculasRede: totalMatriculasFormacaoRede,
                    share:
                      totalMatriculasFormacaoRede === 0
                        ? 0
                        : iaplInput.matriculasFormacaoProfessores / totalMatriculasFormacaoRede,
                    valorCategoriaRede: PESO_IAPL_SUBBLOCO * input.orcamentoTotal * IAPL_SPLIT.FORMACAO_PROFESSORES,
                    valorReais: iaplD.valorFormacaoProfessores,
                  },
                  proeja: {
                    matriculasCampus: iaplInput.matriculasProeja,
                    totalMatriculasRede: totalMatriculasProejaRede,
                    share: totalMatriculasProejaRede === 0 ? 0 : iaplInput.matriculasProeja / totalMatriculasProejaRede,
                    valorCategoriaRede: PESO_IAPL_SUBBLOCO * input.orcamentoTotal * IAPL_SPLIT.PROEJA,
                    valorReais: iaplD.valorProeja,
                  },
                  pesoSubBloco: PESO_IAPL_SUBBLOCO,
                  valorSubBlocoRede: PESO_IAPL_SUBBLOCO * input.orcamentoTotal,
                  valorTotal: iaplD.valorTotal,
                }
              : null,
          valorTotal: q.valorTotal,
        },
      };
    }),
  ];

  if (resultados.length > 0) {
    await prisma.calculationResult.createMany({ data: resultados });
  }

  await prisma.calculationRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });

  return {
    runId: run.id,
    unidadeCount: funcionamento.length,
  };
}
