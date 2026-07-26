"use server";

import { prisma } from "@/server/db/prisma";
import { blocoFuncionamento, type FuncionamentoInput } from "@/calculation-engine/blocoFuncionamento";
import { aplicarPisoMinimoCampusNovo } from "@/calculation-engine/aplicarPisoMinimoCampusNovo";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { blocoQualidadeEficiencia } from "@/calculation-engine/blocoQualidadeEficiencia";
import { blocoAssistenciaEstudantil } from "@/calculation-engine/blocoAssistenciaEstudantil";
import { calcularAnuidadeConif } from "@/calculation-engine/anuidadeConif";
import type {
  AssistenciaEstudantilCampusInput,
  AssistenciaEstudantilRfpInput,
} from "@/calculation-engine/types/assistenciaEstudantil.types";
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
  ANO_MINIMO_CAMPUS_NOVO,
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
  /** Instituições (autarquias) incluídas neste cálculo — escopa todas as consultas de fatos. */
  instituicaoIds: number[];
  /**
   * `orcamentoTotal` é o Custeio (Ação 20RL) do escopo inteiro (todas as instituições em
   * `instituicaoIds` juntas) — dividido entre elas e seus câmpus pela metodologia dos blocos, não
   * copiado integralmente para cada uma.
   */
  orcamentoTotal: number;
  /**
   * Orçamento da Ação 2994 (Assistência Estudantil / PNAES) do escopo inteiro — isolado do
   * Custeio 20RL (`orcamentoTotal`), não fatiado em 80/10/10 (ver blocoAssistenciaEstudantil.ts).
   * Padrão 0 (nenhum valor de Assistência Estudantil distribuído) quando omitido.
   */
  orcamentoAssistenciaEstudantil?: number;
  /**
   * Percentual (escala 0-100) da anuidade CONIF, calculado sobre o Custeio (20RL) já distribuído
   * de cada instituição (Funcionamento + Reitorias + Qualidade e Eficiência). Informativo — não é
   * deduzido do valor que a instituição recebe (ver calcularAnuidadeConif). Padrão 0 quando omitido.
   */
  percentualAnuidade?: number;
  /**
   * Piso mínimo em R$ do Bloco Funcionamento para câmpus criados a partir de 2018
   * (`Unidade.anoCriacao`), já com o IPCA do ano aplicado externamente — ver
   * aplicarPisoMinimoCampusNovo.ts. Padrão 0 (regra desativada) quando omitido.
   */
  pisoMinimoCampusNovo?: number;
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
  /** Escopo usado para resolver `instituicaoIds` (CONIF ou Todas) — guardado para auditoria/exibição. */
  escopo?: "TODAS" | "CONIF";
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
const MEDIDA_NUMERO_MATRICULAS = "Número de Matrículas";
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

function aplicarOverrideIea(
  inputs: IeaInput[],
  overrides: Record<number, CampusOverride>,
  instituicaoIdPorCampus: Map<number, number>,
): IeaInput[] {
  const resultado = [...inputs];
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    if (override.valorIeaPercentual === undefined) continue;
    const unidadeId = Number(unidadeIdStr);
    const index = resultado.findIndex((i) => i.campusId === unidadeId);
    const instituicaoId = resultado[index]?.instituicaoId ?? instituicaoIdPorCampus.get(unidadeId);
    if (instituicaoId === undefined) continue;
    const item: IeaInput = { campusId: unidadeId, instituicaoId, valorIea: override.valorIeaPercentual / 100 };
    if (index === -1) resultado.push(item);
    else resultado[index] = item;
  }
  return resultado;
}

function aplicarOverrideRap(
  inputs: RapInput[],
  overrides: Record<number, CampusOverride>,
  instituicaoIdPorCampus: Map<number, number>,
): RapInput[] {
  const resultado = [...inputs];
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    if (override.razaoDocenteAluno === undefined) continue;
    const unidadeId = Number(unidadeIdStr);
    const index = resultado.findIndex((i) => i.campusId === unidadeId);
    const instituicaoId = resultado[index]?.instituicaoId ?? instituicaoIdPorCampus.get(unidadeId);
    if (instituicaoId === undefined) continue;
    const item: RapInput = { campusId: unidadeId, instituicaoId, razaoDocenteAluno: override.razaoDocenteAluno };
    if (index === -1) resultado.push(item);
    else resultado[index] = item;
  }
  return resultado;
}

function aplicarOverrideIapl(
  mapa: Map<number, IaplCampusInput>,
  overrides: Record<number, CampusOverride>,
  instituicaoIdPorCampus: Map<number, number>,
): Map<number, IaplCampusInput> {
  const resultado = new Map(mapa);
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    const temCampoIapl =
      override.matriculasTecnicos !== undefined ||
      override.matriculasFormacaoProfessores !== undefined ||
      override.matriculasProeja !== undefined;
    if (!temCampoIapl) continue;
    const unidadeId = Number(unidadeIdStr);
    const atual = resultado.get(unidadeId);
    const instituicaoId = atual?.instituicaoId ?? instituicaoIdPorCampus.get(unidadeId);
    if (instituicaoId === undefined) continue;
    resultado.set(unidadeId, {
      campusId: unidadeId,
      instituicaoId,
      matriculasTecnicos: override.matriculasTecnicos ?? atual?.matriculasTecnicos ?? 0,
      matriculasFormacaoProfessores: override.matriculasFormacaoProfessores ?? atual?.matriculasFormacaoProfessores ?? 0,
      matriculasProeja: override.matriculasProeja ?? atual?.matriculasProeja ?? 0,
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
 *
 * Bloco Funcionamento e Bloco Qualidade e Eficiência são naturalmente agnósticos a quantas
 * instituições estão representadas — operam sobre a lista plana de câmpus de todo `instituicaoIds`,
 * então o câmpus de uma instituição maior/com melhores indicadores recebe uma fatia maior do bloco,
 * não um valor fixo por instituição. O Bloco Reitorias usa a mesma base do Bloco Funcionamento
 * (matrícula ponderada), só agregada por instituição em vez de por câmpus — uma instituição maior
 * recebe uma fatia maior dos 10% (Portaria MEC nº 646/2022, Art. 3º, II; ver `blocoReitorias.ts`).
 */
export async function runCalculation(input: RunCalculationInput): Promise<RunCalculationResult> {
  const overrides = input.overridesPorUnidade ?? {};

  const mateqPorUnidade = await prisma.fatoIndicador.groupBy({
    by: ["unidadeId", "instituicaoId"],
    where: {
      fileType: "DADOS_GERAIS",
      medida: MEDIDA_MATRICULA_EQUIVALENTE_GERAL,
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
    _sum: { valor: true },
  });

  // Câmpus elegíveis ao Piso Mínimo (anoCriacao >= ANO_MINIMO_CAMPUS_NOVO) mas sem nenhuma linha de
  // Matrícula Equivalente no ano base (recém-criados, ainda não consolidados na PNP) precisam entrar
  // no Bloco Funcionamento com matrícula ponderada 0 — do contrário nunca aparecem no groupBy acima e
  // ficam de fora por completo, mesmo tendo direito ao piso (ver aplicarPisoMinimoCampusNovo.ts). Só
  // vale a consulta extra quando o piso está de fato configurado.
  let campusElegiveisSemMatricula: { id: number; instituicaoId: number }[] = [];
  if ((input.pisoMinimoCampusNovo ?? 0) > 0) {
    const idsComMatricula = mateqPorUnidade
      .filter((f) => f.unidadeId !== null)
      .map((f) => f.unidadeId as number);
    campusElegiveisSemMatricula = await prisma.unidade.findMany({
      where: {
        instituicaoId: { in: input.instituicaoIds },
        anoCriacao: { gte: ANO_MINIMO_CAMPUS_NOVO },
        id: { notIn: idsComMatricula },
      },
      select: { id: true, instituicaoId: true },
    });
  }

  // Matrículas brutas (antes da equalização MECHDA da PNP) — só para exibição na memória de
  // cálculo (mostrar a conversão Bruta → Equivalente), nunca usadas no rateio em si: a PNP já
  // aplica sua própria metodologia de pesos (modalidade, laboratórios, retenção etc.) para chegar
  // na Matrícula Equivalente, e reaplicá-los aqui contaria os pesos em dobro.
  const matriculasBrutasPorUnidade = await prisma.fatoIndicador.groupBy({
    by: ["unidadeId"],
    where: {
      fileType: "DADOS_GERAIS",
      medida: MEDIDA_NUMERO_MATRICULAS,
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
    _sum: { valor: true },
  });
  const matriculasBrutasPorCampus = new Map(
    matriculasBrutasPorUnidade.map((f) => [f.unidadeId as number, Number(f._sum.valor ?? 0)]),
  );
  const totalMatriculasBrutasRede = matriculasBrutasPorUnidade.reduce(
    (s, f) => s + Number(f._sum.valor ?? 0),
    0,
  );

  const funcionamentoInputs = aplicarOverrideFuncionamento(
    [
      ...mateqPorUnidade
        .filter((f) => f.unidadeId !== null)
        .map((f) => ({
          campusId: f.unidadeId as number,
          matriculaPonderada: Number(f._sum.valor ?? 0),
        })),
      ...campusElegiveisSemMatricula.map((u) => ({ campusId: u.id, matriculaPonderada: 0 })),
    ],
    overrides,
  );

  // Bloco Reitorias usa a mesma base do Bloco Funcionamento (matrícula ponderada
  // pós-override), só que agregada por instituição — ver blocoReitorias.ts.
  const instituicaoIdPorCampus = new Map([
    ...mateqPorUnidade
      .filter((f) => f.unidadeId !== null)
      .map((f): [number, number] => [f.unidadeId as number, f.instituicaoId]),
    ...campusElegiveisSemMatricula.map((u): [number, number] => [u.id, u.instituicaoId]),
  ]);
  const reitoriaInputs = funcionamentoInputs
    .map((f) => {
      const instituicaoId = instituicaoIdPorCampus.get(f.campusId);
      return instituicaoId !== undefined ? { instituicaoId, matriculaPonderada: f.matriculaPonderada } : null;
    })
    .filter((r): r is { instituicaoId: number; matriculaPonderada: number } => r !== null);

  const ieaFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "EFICIENCIA_ACADEMICA",
      medida: MEDIDA_INDICE_EFICIENCIA_ACADEMICA,
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
  });
  // PNP entrega o IEA em escala 0-100%; bucketizeIea espera [0, 1].
  const ieaInputs = aplicarOverrideIea(
    ieaFatos.map((f) => ({
      campusId: f.unidadeId as number,
      instituicaoId: f.instituicaoId,
      valorIea: Number(f.valor) / 100,
    })),
    overrides,
    instituicaoIdPorCampus,
  );

  const rapFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
      medida: MEDIDA_RAP,
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
  });
  const rapInputs = aplicarOverrideRap(
    rapFatos.map((f) => ({
      campusId: f.unidadeId as number,
      instituicaoId: f.instituicaoId,
      razaoDocenteAluno: Number(f.valor),
    })),
    overrides,
    instituicaoIdPorCampus,
  );

  const iaplFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "PERCENTUAIS_LEGAIS",
      medida: { in: Object.keys(IAPL_CAMPO_POR_MEDIDA) },
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
  });
  let iaplPorUnidade = new Map<number, IaplCampusInput>();
  for (const fato of iaplFatos) {
    const unidadeId = fato.unidadeId as number;
    const atual = iaplPorUnidade.get(unidadeId) ?? {
      campusId: unidadeId,
      instituicaoId: fato.instituicaoId,
      matriculasTecnicos: 0,
      matriculasFormacaoProfessores: 0,
      matriculasProeja: 0,
    };
    const campo = IAPL_CAMPO_POR_MEDIDA[fato.medida as keyof typeof IAPL_CAMPO_POR_MEDIDA];
    atual[campo] += Number(fato.valor);
    iaplPorUnidade.set(unidadeId, atual);
  }
  iaplPorUnidade = aplicarOverrideIapl(iaplPorUnidade, overrides, instituicaoIdPorCampus);
  const iaplInputs = Array.from(iaplPorUnidade.values());

  // Faixa de RFP (Renda Familiar Per Capita) só existe por instituição na PNP real
  // (ClassificacaoRacialRendaSexo.csv não tem unidadeId) — ver blocoAssistenciaEstudantil.ts.
  const rendaFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "CLASSIFICACAO_RACIAL_RENDA_SEXO",
      medida: "Número de Matrículas",
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
    },
  });
  const rfpInputs: AssistenciaEstudantilRfpInput[] = rendaFatos.map((f) => ({
    instituicaoId: f.instituicaoId,
    faixaRfp: (f.dimensoesExtra as { rendaFamiliar?: string } | null)?.rendaFamiliar ?? "",
    numeroMatriculas: Number(f.valor),
  }));
  const mateqPorUnidadeModalidade = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "DADOS_GERAIS",
      medida: MEDIDA_MATRICULA_EQUIVALENTE_GERAL,
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
    select: { unidadeId: true, instituicaoId: true, dimensoesExtra: true, valor: true },
  });
  // MECHDA da Assistência Estudantil pondera Presencial (peso cheio) e EAD (peso 1/4)
  // separadamente — precisamos da mesma "Matrícula Equivalente | Geral" acima, mas
  // aberta por modalidadeEnsino. Como essa dimensão vive em `dimensoesExtra` (JSON), não dá
  // pra usar groupBy do Prisma — por isso uma segunda consulta com agregação em memória,
  // em vez de reaproveitar `funcionamentoInputs` (que soma as modalidades cegamente).
  const matriculaPonderadaPorUnidadeModalidade = new Map<
    number,
    { instituicaoId: number; presencial: number; ead: number }
  >();
  for (const fato of mateqPorUnidadeModalidade) {
    const unidadeId = fato.unidadeId as number;
    const atual = matriculaPonderadaPorUnidadeModalidade.get(unidadeId) ?? {
      instituicaoId: fato.instituicaoId,
      presencial: 0,
      ead: 0,
    };
    const modalidade = (fato.dimensoesExtra as { modalidadeEnsino?: string } | null)?.modalidadeEnsino;
    if (modalidade === "Educação Presencial") {
      atual.presencial += Number(fato.valor);
    } else {
      atual.ead += Number(fato.valor);
    }
    matriculaPonderadaPorUnidadeModalidade.set(unidadeId, atual);
  }
  const assistenciaEstudantilCampusInputs: AssistenciaEstudantilCampusInput[] = Array.from(
    matriculaPonderadaPorUnidadeModalidade.entries(),
  ).map(([campusId, valores]) => ({
    campusId,
    instituicaoId: valores.instituicaoId,
    matriculaPonderadaPresencial: valores.presencial,
    matriculaPonderadaEad: valores.ead,
  }));

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

  // Piso Mínimo por Câmpus Novo: só afeta o Bloco Funcionamento (Reitorias/Qualidade e
  // Eficiência continuam usando a Matrícula Ponderada crua, sem o piso — ver blocoReitorias.ts).
  const unidadesAnoCriacao = await prisma.unidade.findMany({
    where: { id: { in: funcionamentoInputs.map((f) => f.campusId) } },
    select: { id: true, anoCriacao: true },
  });
  const anoCriacaoPorCampus = new Map(unidadesAnoCriacao.map((u) => [u.id, u.anoCriacao]));
  const funcionamento = aplicarPisoMinimoCampusNovo(
    blocoFuncionamento(funcionamentoInputs, input.orcamentoTotal),
    anoCriacaoPorCampus,
    input.pisoMinimoCampusNovo ?? 0,
  );
  const reitorias = blocoReitorias(reitoriaInputs, input.orcamentoTotal);
  const qualidadeEficiencia = blocoQualidadeEficiencia(ieaInputs, rapInputs, iaplInputs, input.orcamentoTotal);
  const assistenciaEstudantil = blocoAssistenciaEstudantil(
    rfpInputs,
    assistenciaEstudantilCampusInputs,
    input.orcamentoAssistenciaEstudantil ?? 0,
  );
  const assistenciaEstudantilPorCampus = new Map(assistenciaEstudantil.map((a) => [a.campusId, a]));

  // Anuidade CONIF: percentual sobre o Custeio (20RL) já distribuído de cada instituição
  // (Funcionamento agregado por instituição + Reitorias + Qualidade e Eficiência) — informativo,
  // não deduzido do valor distribuído (ver calcularAnuidadeConif).
  const custeioPorInstituicao = new Map<number, number>();
  for (const f of funcionamento) {
    const instituicaoId = instituicaoIdPorCampus.get(f.campusId);
    if (instituicaoId === undefined) continue;
    custeioPorInstituicao.set(instituicaoId, (custeioPorInstituicao.get(instituicaoId) ?? 0) + f.valorReais);
  }
  for (const r of reitorias) {
    custeioPorInstituicao.set(r.autarquiaId, (custeioPorInstituicao.get(r.autarquiaId) ?? 0) + r.valorReais);
  }
  for (const q of qualidadeEficiencia) {
    custeioPorInstituicao.set(
      q.instituicaoId,
      (custeioPorInstituicao.get(q.instituicaoId) ?? 0) + q.valorTotal,
    );
  }
  const anuidadeConif = calcularAnuidadeConif(
    Array.from(custeioPorInstituicao.entries()).map(([instituicaoId, custeioInstituicao]) => ({
      instituicaoId,
      custeioInstituicao,
    })),
    input.percentualAnuidade ?? 0,
  );

  // Recalculados isoladamente (mesmas funções puras, mesmos inputs finais) só para expor
  // band/peso/share por sub-bloco na memória de cálculo — blocoQualidadeEficiencia não
  // expõe esse detalhe, só o valor combinado. Agora por instituição, não por câmpus (ver
  // blocoQualidadeEficiencia.ts).
  const ieaDetalhePorInstituicao = new Map(
    calcularBlocoIea(ieaInputs, input.orcamentoTotal).map((d) => [d.instituicaoId, d]),
  );
  const rapDetalhePorInstituicao = new Map(
    calcularBlocoRap(rapInputs, input.orcamentoTotal).map((d) => [d.instituicaoId, d]),
  );
  const iaplDetalhePorInstituicao = new Map(
    calcularBlocoIapl(iaplInputs, input.orcamentoTotal).map((d) => [d.instituicaoId, d]),
  );

  const parametersSnapshot = {
    instituicaoIds: input.instituicaoIds,
    escopo: input.escopo ?? null,
    ano: input.ano,
    anoOrcamento: input.anoOrcamento ?? null,
    orcamentoTotal: input.orcamentoTotal,
    orcamentoAssistenciaEstudantil: input.orcamentoAssistenciaEstudantil ?? 0,
    percentualAnuidade: input.percentualAnuidade ?? 0,
    pisoMinimoCampusNovo: input.pisoMinimoCampusNovo ?? 0,
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
        matriculasBrutasCampus: matriculasBrutasPorCampus.get(f.campusId) ?? 0,
        totalMatriculasBrutasRede,
        share: f.share,
        pesoBloco: PESO_BLOCO_FUNCIONAMENTO,
        valorBlocoRede: PESO_BLOCO_FUNCIONAMENTO * input.orcamentoTotal,
        pisoMinimoCampusNovo: input.pisoMinimoCampusNovo ?? 0,
        pisoAplicado: f.pisoAplicado,
        valorAntesDoPiso: f.valorAntesDoPiso,
        valorReais: f.valorReais,
      },
    })),
    ...reitorias.map((r) => ({
      runId: run.id,
      campusId: null,
      bloco: "REITORIAS" as const,
      metrica: `valorReais_autarquia_${r.autarquiaId}`,
      valor: r.valorReais,
      detalhe: {
        numeroInstituicoes: input.instituicaoIds.length,
        matriculaPonderadaInstituicao: r.totalMatriculaPonderada,
        totalMatriculaPonderadaRede,
        share: r.share,
        pesoBloco: PESO_BLOCO_REITORIAS,
        valorBlocoRede: PESO_BLOCO_REITORIAS * input.orcamentoTotal,
        valorReais: r.valorReais,
      },
    })),
    ...qualidadeEficiencia.map((q) => {
      const ieaD = ieaDetalhePorInstituicao.get(q.instituicaoId);
      const rapD = rapDetalhePorInstituicao.get(q.instituicaoId);
      const iaplD = iaplDetalhePorInstituicao.get(q.instituicaoId);

      return {
        runId: run.id,
        campusId: null,
        bloco: "QUALIDADE_EFICIENCIA" as const,
        metrica: `valorReais_autarquia_${q.instituicaoId}`,
        valor: q.valorTotal,
        detalhe: {
          iea: ieaD
            ? {
                porCampus: ieaD.porCampus,
                ponderadoInstituicao: ieaD.ponderadoInstituicao,
                somaPonderadosRede: somaPonderadosIeaRede,
                share: ieaD.share,
                pesoSubBloco: PESO_IEA_SUBBLOCO,
                valorSubBlocoRede: PESO_IEA_SUBBLOCO * input.orcamentoTotal,
                valorReais: ieaD.valorReais,
              }
            : null,
          rap: rapD
            ? {
                porCampus: rapD.porCampus,
                ponderadoInstituicao: rapD.ponderadoInstituicao,
                somaPonderadosRede: somaPonderadosRapRede,
                share: rapD.share,
                pesoSubBloco: PESO_RAP_SUBBLOCO,
                valorSubBlocoRede: PESO_RAP_SUBBLOCO * input.orcamentoTotal,
                valorReais: rapD.valorReais,
              }
            : null,
          iapl: iaplD
            ? {
                tecnicos: {
                  matriculasInstituicao: iaplD.matriculasTecnicos,
                  totalMatriculasRede: totalMatriculasTecnicosRede,
                  share:
                    totalMatriculasTecnicosRede === 0 ? 0 : iaplD.matriculasTecnicos / totalMatriculasTecnicosRede,
                  valorCategoriaRede: PESO_IAPL_SUBBLOCO * input.orcamentoTotal * IAPL_SPLIT.CURSOS_TECNICOS,
                  valorReais: iaplD.valorTecnicos,
                },
                formacaoProfessores: {
                  matriculasInstituicao: iaplD.matriculasFormacaoProfessores,
                  totalMatriculasRede: totalMatriculasFormacaoRede,
                  share:
                    totalMatriculasFormacaoRede === 0
                      ? 0
                      : iaplD.matriculasFormacaoProfessores / totalMatriculasFormacaoRede,
                  valorCategoriaRede: PESO_IAPL_SUBBLOCO * input.orcamentoTotal * IAPL_SPLIT.FORMACAO_PROFESSORES,
                  valorReais: iaplD.valorFormacaoProfessores,
                },
                proeja: {
                  matriculasInstituicao: iaplD.matriculasProeja,
                  totalMatriculasRede: totalMatriculasProejaRede,
                  share: totalMatriculasProejaRede === 0 ? 0 : iaplD.matriculasProeja / totalMatriculasProejaRede,
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
    ...Array.from(assistenciaEstudantilPorCampus.values()).map((a) => ({
      runId: run.id,
      campusId: a.campusId,
      bloco: "ASSISTENCIA_ESTUDANTIL" as const,
      metrica: "valorReais",
      valor: a.valorReais,
      detalhe: {
        vrInstituicao: a.vrInstituicao,
        mechdaInstituicao: a.mechdaInstituicao,
        participacaoPonderadaInstituicao: a.participacaoPonderadaInstituicao,
        somaParticipacoesRede: a.somaParticipacoesRede,
        shareInstituicao: a.shareInstituicao,
        valorOrcamentoAssistenciaEstudantil: input.orcamentoAssistenciaEstudantil ?? 0,
        valorInstituicao: a.valorInstituicao,
        matriculaPonderadaCampus: a.matriculaPonderadaCampus,
        matriculaPonderadaInstituicao: a.matriculaPonderadaInstituicao,
        shareDentroInstituicao: a.shareDentroInstituicao,
        valorReais: a.valorReais,
      },
    })),
    ...anuidadeConif.map((a) => ({
      runId: run.id,
      campusId: null,
      bloco: "ANUIDADE_CONIF" as const,
      metrica: `valorReais_autarquia_${a.instituicaoId}`,
      valor: a.valorReais,
      detalhe: {
        custeioInstituicao: a.custeioInstituicao,
        percentualAnuidade: a.percentualAnuidade,
        valorReais: a.valorReais,
      },
    })),
  ];

  if (resultados.length > 0) {
    // `detalhe.iea`/`.rap` agora incluem um array de objetos tipados (`porCampus`) — o checker de tipos
    // JSON do Prisma exige um round-trip por JSON puro (mesmo padrão já usado em `parametersSnapshot`).
    await prisma.calculationResult.createMany({ data: JSON.parse(JSON.stringify(resultados)) });
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
