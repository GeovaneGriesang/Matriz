"use server";

import { prisma } from "@/server/db/prisma";
import { blocoFuncionamento, type FuncionamentoInput } from "@/calculation-engine/blocoFuncionamento";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { blocoQualidadeEficiencia } from "@/calculation-engine/blocoQualidadeEficiencia";
import * as qualidadeEficienciaConstants from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import * as blocosConstants from "@/calculation-engine/constants/blocos.constants";
import type {
  IaplCampusInput,
  IeaInput,
  RapInput,
} from "@/calculation-engine/types/qualidadeEficiencia.types";

export interface RunCalculationInput {
  orcamentoTotal: number;
  /** Ano de referência (ano da PNP) cujos fatos já ingeridos alimentam o cálculo. */
  ano: number;
}

export interface RunCalculationResult {
  runId: number;
  unidadeCount: number;
  instituicaoCount: number;
}

const MEDIDA_MATRICULA_EQUIVALENTE_GERAL = "Matrícula Equivalente | Geral";
const MEDIDA_INDICE_EFICIENCIA_ACADEMICA = "Eficiência Acadêmica | Índice de Eficiência Acadêmica %";
const MEDIDA_RAP = "RAP | RAP";

const IAPL_CAMPO_POR_MEDIDA = {
  "Matrícula Equivalente | Técnicos": "matriculasTecnicos",
  "Matrícula Equivalente | Formação de Professores": "matriculasFormacaoProfessores",
  "Matrícula Equivalente | Proeja": "matriculasProeja",
} as const satisfies Record<string, keyof Omit<IaplCampusInput, "campusId">>;

/**
 * Executa um run de cálculo completo (Bloco Funcionamento + Reitorias + Qualidade
 * e Eficiência) sobre os fatos já ingeridos (`FatoIndicador`) para o ano
 * informado, e persiste o resultado com um snapshot dos parâmetros (constantes)
 * usados, para auditoria futura.
 *
 * A Matrícula Ponderada do Bloco de Funcionamento usa a Matrícula Equivalente
 * oficial da PNP (DadosGerais, medida "Matrícula Equivalente | Geral") somada
 * por unidade — a PNP já aplica sua própria metodologia de peso, então não
 * reimplementamos um cálculo por matrícula individual.
 *
 * Nota: o valor de Reitorias é armazenado com `campusId = null` e o id da
 * instituição codificado na `metrica` (`valorReais_autarquia_<id>`), já que
 * `CalculationResult` não tem uma coluna dedicada para instituição na M1.
 */
export async function runCalculation(input: RunCalculationInput): Promise<RunCalculationResult> {
  const mateqPorUnidade = await prisma.fatoIndicador.groupBy({
    by: ["unidadeId"],
    where: {
      fileType: "DADOS_GERAIS",
      medida: MEDIDA_MATRICULA_EQUIVALENTE_GERAL,
      ano: input.ano,
      unidadeId: { not: null },
    },
    _sum: { valor: true },
  });

  const funcionamentoInputs: FuncionamentoInput[] = mateqPorUnidade
    .filter((f) => f.unidadeId !== null)
    .map((f) => ({
      campusId: f.unidadeId as number,
      matriculaPonderada: Number(f._sum.valor ?? 0),
    }));

  const instituicoes = await prisma.instituicao.findMany({ select: { id: true } });
  const instituicaoIds = instituicoes.map((i) => i.id);

  const ieaFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "EFICIENCIA_ACADEMICA",
      medida: MEDIDA_INDICE_EFICIENCIA_ACADEMICA,
      ano: input.ano,
      unidadeId: { not: null },
    },
  });
  // PNP entrega o IEA em escala 0-100%; bucketizeIea espera [0, 1].
  const ieaInputs: IeaInput[] = ieaFatos.map((f) => ({
    campusId: f.unidadeId as number,
    valorIea: Number(f.valor) / 100,
  }));

  const rapFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
      medida: MEDIDA_RAP,
      ano: input.ano,
      unidadeId: { not: null },
    },
  });
  const rapInputs: RapInput[] = rapFatos.map((f) => ({
    campusId: f.unidadeId as number,
    razaoDocenteAluno: Number(f.valor),
  }));

  const iaplFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "PERCENTUAIS_LEGAIS",
      medida: { in: Object.keys(IAPL_CAMPO_POR_MEDIDA) },
      ano: input.ano,
      unidadeId: { not: null },
    },
  });
  const iaplPorUnidade = new Map<number, IaplCampusInput>();
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

  const funcionamento = blocoFuncionamento(funcionamentoInputs, input.orcamentoTotal);
  const reitorias = blocoReitorias(instituicaoIds, input.orcamentoTotal);
  const qualidadeEficiencia = blocoQualidadeEficiencia(
    ieaInputs,
    rapInputs,
    Array.from(iaplPorUnidade.values()),
    input.orcamentoTotal,
  );

  const parametersSnapshot = {
    ano: input.ano,
    qualidadeEficiencia: qualidadeEficienciaConstants,
    blocos: blocosConstants,
  };

  const run = await prisma.calculationRun.create({
    data: {
      status: "RUNNING",
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
    })),
    ...reitorias.map((r) => ({
      runId: run.id,
      campusId: null,
      bloco: "REITORIAS" as const,
      metrica: `valorReais_autarquia_${r.autarquiaId}`,
      valor: r.valorReais,
    })),
    ...qualidadeEficiencia.map((q) => ({
      runId: run.id,
      campusId: q.campusId,
      bloco: "QUALIDADE_EFICIENCIA" as const,
      metrica: "valorReais",
      valor: q.valorTotal,
    })),
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
    instituicaoCount: instituicaoIds.length,
  };
}
