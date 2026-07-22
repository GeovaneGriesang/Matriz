"use server";

import { prisma } from "@/server/db/prisma";
import { calcularMatriculaPonderada } from "@/calculation-engine/alunoMatriz/calcularMatriculaPonderada";
import { blocoFuncionamento, type FuncionamentoInput } from "@/calculation-engine/blocoFuncionamento";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { blocoQualidadeEficiencia } from "@/calculation-engine/blocoQualidadeEficiencia";
import * as alunoMatrizConstants from "@/calculation-engine/constants/alunoMatriz.constants";
import * as qualidadeEficienciaConstants from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import * as blocosConstants from "@/calculation-engine/constants/blocos.constants";
import type {
  IaplCampusInput,
  IeaInput,
  RapInput,
} from "@/calculation-engine/types/qualidadeEficiencia.types";
import type {
  LabInfraTier,
  ModalidadeEnsino,
  NivelCurso,
} from "@/calculation-engine/types/alunoMatriz.types";

export interface RunCalculationInput {
  orcamentoTotal: number;
}

export interface RunCalculationResult {
  runId: number;
  campusCount: number;
  autarquiaCount: number;
}

/** Curso do eixo agropecuário — placeholder até a lista completa do CNCT ser confirmada. */
function isEixoAgricola(eixoTecnologico: string): boolean {
  return eixoTecnologico === "RECURSOS_NATURAIS";
}

/**
 * Executa um run de cálculo completo (Bloco Funcionamento + Reitorias + Qualidade
 * e Eficiência) sobre os dados atualmente no banco e persiste o resultado com
 * um snapshot dos parâmetros (constantes) usados, para auditoria futura.
 *
 * Nota: o valor de Reitorias é armazenado com `campusId = null` e o id da
 * autarquia codificado na `metrica` (`valorReais_autarquia_<id>`), já que
 * `CalculationResult` não tem uma coluna dedicada para autarquia na M1.
 */
export async function runCalculation(input: RunCalculationInput): Promise<RunCalculationResult> {
  const cursos = await prisma.curso.findMany({
    include: { matriculas: true, campus: true },
  });
  const campi = await prisma.campus.findMany();
  const indicadores = await prisma.indicadorCampus.findMany();

  const funcionamentoInputs: FuncionamentoInput[] = [];
  for (const curso of cursos) {
    for (const matricula of curso.matriculas) {
      const resultado = calcularMatriculaPonderada({
        matriculaEquivalente: Number(matricula.matriculaEquivalente),
        modalidade: curso.modalidade as ModalidadeEnsino,
        nivel: curso.nivel as NivelCurso,
        eixoAgricola: isEixoAgricola(curso.eixoTecnologico),
        labInfraTier: curso.cnctLabTier as LabInfraTier,
        dataIngressoCiclo: matricula.dataIngressoCiclo ?? matricula.dataReferencia,
        dataReferencia: matricula.dataReferencia,
      });
      funcionamentoInputs.push({
        campusId: curso.campusId,
        matriculaPonderada: resultado.matriculaPonderada,
      });
    }
  }

  const autarquiaIds = Array.from(new Set(campi.map((c) => c.autarquiaId)));

  const ieaInputs: IeaInput[] = indicadores
    .filter((i) => i.tipo === "IEA")
    .map((i) => ({ campusId: i.campusId, valorIea: Number(i.valor) }));

  // Ingestão de indicadores RAP ainda não persiste linhas de fato (ver
  // persistIngestionBatch.ts) — sem dados de RAP, o sub-bloco fica vazio.
  const rapInputs: RapInput[] = [];

  const iaplPorCampus = new Map<number, IaplCampusInput>();
  for (const indicador of indicadores) {
    if (
      indicador.tipo !== "IAPL_TECNICOS" &&
      indicador.tipo !== "IAPL_FORMACAO_PROFESSORES" &&
      indicador.tipo !== "IAPL_PROEJA"
    ) {
      continue;
    }
    const atual = iaplPorCampus.get(indicador.campusId) ?? {
      campusId: indicador.campusId,
      matriculasTecnicos: 0,
      matriculasFormacaoProfessores: 0,
      matriculasProeja: 0,
    };
    if (indicador.tipo === "IAPL_TECNICOS") atual.matriculasTecnicos += Number(indicador.valor);
    if (indicador.tipo === "IAPL_FORMACAO_PROFESSORES")
      atual.matriculasFormacaoProfessores += Number(indicador.valor);
    if (indicador.tipo === "IAPL_PROEJA") atual.matriculasProeja += Number(indicador.valor);
    iaplPorCampus.set(indicador.campusId, atual);
  }

  const funcionamento = blocoFuncionamento(funcionamentoInputs, input.orcamentoTotal);
  const reitorias = blocoReitorias(autarquiaIds, input.orcamentoTotal);
  const qualidadeEficiencia = blocoQualidadeEficiencia(
    ieaInputs,
    rapInputs,
    Array.from(iaplPorCampus.values()),
    input.orcamentoTotal,
  );

  const parametersSnapshot = {
    alunoMatriz: alunoMatrizConstants,
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

  return { runId: run.id, campusCount: funcionamento.length, autarquiaCount: autarquiaIds.length };
}
