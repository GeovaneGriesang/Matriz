"use server";

import { prisma } from "@/server/db/prisma";
import { blocoFuncionamento, type FuncionamentoInput } from "@/calculation-engine/blocoFuncionamento";
import {
  calcularMatriculaTotalEqualizadaPonderada,
  type MatriculaTotalEqualizadaRegistro,
  type MatriculaTotalEqualizadaPonderada,
} from "@/calculation-engine/matriculaTotalEqualizada";
import { aplicarPisoMinimoCampusNovo } from "@/calculation-engine/aplicarPisoMinimoCampusNovo";
import { DEFASAGEM_ANOS_REFERENCIA_PNP } from "@/server/config/orcamentoAnual.constants";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { blocoQualidadeEficiencia } from "@/calculation-engine/blocoQualidadeEficiencia";
import { blocoAssistenciaEstudantil } from "@/calculation-engine/blocoAssistenciaEstudantil";
import { calcularAnuidadeConif } from "@/calculation-engine/anuidadeConif";
import type {
  AssistenciaEstudantilCampusInput,
  AssistenciaEstudantilRfpInput,
} from "@/calculation-engine/types/assistenciaEstudantil.types";
import { calcularBlocoIea } from "@/calculation-engine/qualidadeEficiencia/iea/calcularBlocoIea";
import { calcularBlocoRap } from "@/calculation-engine/qualidadeEficiencia/rap/calcularBlocoRap";
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
import { ESTRATEGIA_FAIXAS_IEA_PADRAO } from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import type {
  EstrategiaFaixasIea,
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
   * `orcamentoTotal` é o Custeio (Ação 20RL) BRUTO do escopo inteiro (todas as instituições em
   * `instituicaoIds` juntas) — a base real dividida em Funcionamento 80% / Reitorias 10% /
   * Qualidade e Eficiência 10% é `orcamentoTotal - ajuste` (ver `ajuste` abaixo).
   */
  orcamentoTotal: number;
  /**
   * Dedução sobre `orcamentoTotal` ANTES de aplicar os pesos 80/10/10 — corresponde ao "Ajuste" da
   * planilha-modelo CONIF (DADOS BASE!M26), calibrado ali contra uma Assistência estimada por IPCA
   * diferente da Assistência real já usada em `orcamentoAssistenciaEstudantil` (ver
   * OrcamentoAnual.ajuste no schema para o valor já resolvido contra os números reais do sistema).
   * Padrão 0 (nenhum ajuste, comportamento anterior ao Prompt 10) quando omitido.
   */
  ajuste?: number;
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
  /**
   * Qual tabela de faixas/pesos de IEA usar no enquadramento (ver qualidadeEficiencia.constants.ts)
   * — "PLANILHA_2026" (padrão) usa os limites da planilha-modelo oficial do ciclo 2026;
   * "FORPLAN_2025" usa os limites do livro "A Matriz Orçamentária da Rede Federal de EPCT"
   * (CONIF/Forplan, 2025). Nenhuma das duas é descartada; o sistema sempre mantém as duas
   * disponíveis. Padrão "PLANILHA_2026" quando omitido.
   */
  estrategiaFaixasIea?: EstrategiaFaixasIea;
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

const IAPL_CAMPO_POR_MEDIDA = {
  "Matrícula Equivalente | Técnicos": "matriculasTecnicos",
  "Matrícula Equivalente | Formação de Professores": "matriculasFormacaoProfessores",
  "Matrícula Equivalente | Proeja": "matriculasProeja",
  "Matrícula Equivalente | Geral": "matriculasGeral",
} as const satisfies Record<string, keyof Omit<IaplCampusInput, "campusId" | "instituicaoId">>;

/**
 * Campos brutos de EficienciaAcademica.csv necessários para calcular o IEA institucional (seção
 * 3.1 da metodologia): nunca ler o "Índice de Eficiência Acadêmica %" já pronto por câmpus e
 * agregá-lo — somar as contagens absolutas primeiro (ver calcularBlocoIea.ts).
 */
const EFICIENCIA_CAMPO_POR_MEDIDA = {
  "Eficiência Acadêmica | Concluídos": "concluidos",
  "Eficiência Acadêmica | Número de Evadidos": "evadidos",
  "Eficiência Acadêmica | Retidos": "retidos",
} as const satisfies Record<string, keyof Omit<IeaInput, "campusId" | "instituicaoId">>;

const MEDIDA_PROFESSOR_EQUIVALENTE = "RAP | Professor Equivalente";
const MODALIDADE_PRESENCIAL = "Educação Presencial";

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

/**
 * IEA só existe em nível de instituição (ver calcularBlocoIea.ts), então um override de "IEA
 * deste câmpus" na prática simula "IEA desta instituição inteira" — resolve o câmpus escolhido no
 * simulador até sua instituição e devolve um mapa instituicaoId → valorIea (0–1) pronto para
 * `calcularBlocoIea`.
 */
function construirOverridesIea(
  overrides: Record<number, CampusOverride>,
  instituicaoIdPorCampus: Map<number, number>,
): Map<number, number> {
  const resultado = new Map<number, number>();
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    if (override.valorIeaPercentual === undefined) continue;
    const unidadeId = Number(unidadeIdStr);
    const instituicaoId = instituicaoIdPorCampus.get(unidadeId);
    if (instituicaoId === undefined) continue;
    resultado.set(instituicaoId, override.valorIeaPercentual / 100);
  }
  return resultado;
}

/**
 * RAP só existe em nível de instituição (ver calcularBlocoRap.ts), então um override de "RAP
 * deste câmpus" na prática simula "RAP desta instituição inteira" — resolve o câmpus escolhido no
 * simulador até sua instituição e devolve um mapa instituicaoId → razaoDocenteAluno pronto para
 * `calcularBlocoRap`.
 */
function construirOverridesRap(
  overrides: Record<number, CampusOverride>,
  instituicaoIdPorCampus: Map<number, number>,
): Map<number, number> {
  const resultado = new Map<number, number>();
  for (const [unidadeIdStr, override] of Object.entries(overrides)) {
    if (override.razaoDocenteAluno === undefined) continue;
    const unidadeId = Number(unidadeIdStr);
    const instituicaoId = instituicaoIdPorCampus.get(unidadeId);
    if (instituicaoId === undefined) continue;
    resultado.set(instituicaoId, override.razaoDocenteAluno);
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
      matriculasGeral: atual?.matriculasGeral ?? 0,
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
  const estrategiaFaixasIea = input.estrategiaFaixasIea ?? ESTRATEGIA_FAIXAS_IEA_PADRAO;
  // Base real dividida em Funcionamento 80% / Reitorias 10% / Qualidade e Eficiência 10% — nunca
  // o Custeio Bruto puro (ver `ajuste` em RunCalculationInput e OrcamentoAnual.ajuste no schema).
  const baseCalculoPercentuais = input.orcamentoTotal - (input.ajuste ?? 0);

  // MatriculaTotalEqualizadaAnual/RappAnual são cadastrados por ano-base do ciclo orçamentário
  // (ex.: 2026), não pelo ano de referência da PNP usado em FatoIndicador (`input.ano`, ex.: 2024).
  // Runs OFICIAIS sempre definem `anoOrcamento` explicitamente (ver calcularDistribuicaoOficialAction)
  // — usamos direto. O Simulador NÃO tem esse campo (só escolhe "ano de referência" da PNP), mas a
  // relação entre os dois anos é fixa e já conhecida do resto do sistema (DEFASAGEM_ANOS_REFERENCIA_PNP
  // = 2), então derivamos `anoOficial = input.ano + 2` em vez de usar `input.ano` cru: usar o ano de
  // referência da PNP diretamente como se fosse ano-base seria um erro sistemático (são conceitos
  // diferentes) que nunca acertaria por coincidência — a derivação abaixo é a única forma do
  // fallback ter chance real de achar dado oficial numa simulação.
  const anoOficial = input.anoOrcamento ?? input.ano + DEFASAGEM_ANOS_REFERENCIA_PNP;

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

  // Matrícula Total equalizada oficial (colunas Q/R/S/T de "COMPLETO PROPOSTA") — cadastrada por
  // câmpus/ano-base em /admin/dados-anuais (ver MatriculaTotalEqualizadaAnual). Busca por TODO o
  // escopo de instituições, não só pelos câmpus já conhecidos via PNP/piso acima: existem câmpus
  // (ex.: "Centro de Referência X") com Matrícula Total equalizada oficial importada mas sem
  // nenhuma linha de "Matrícula Equivalente | Geral" da PNP para `input.ano` e sem `anoCriacao`
  // cadastrado (então não são elegíveis ao piso) — sem essa busca à parte, esses câmpus nunca
  // apareceriam em `mateqPorUnidade` nem em `campusElegiveisSemMatricula` e ficariam de fora do
  // Bloco Funcionamento por completo, mesmo tendo dado oficial disponível. Câmpus sem nenhum
  // registro oficial para `anoOficial` (câmpus novo, ano ainda não importado) caem no placeholder
  // abaixo — ver calcularMatriculaTotalEqualizada.ts, que nunca inventa um valor para o ausente.
  const matriculaOficialRows = await prisma.matriculaTotalEqualizadaAnual.findMany({
    where: { ano: anoOficial, unidade: { instituicaoId: { in: input.instituicaoIds } } },
    select: {
      unidadeId: true,
      matriculaTotalPresencialEqualizada: true,
      matriculaTotalEadEqualizada: true,
      matriculaTotalEadMoocEqualizada: true,
      matriculaTotalEadFpEqualizada: true,
      unidade: { select: { instituicaoId: true } },
    },
  });
  const matriculaOficialPorUnidade = new Map<number, MatriculaTotalEqualizadaRegistro>(
    matriculaOficialRows.map((m) => [
      m.unidadeId,
      {
        matriculaTotalPresencialEqualizada: Number(m.matriculaTotalPresencialEqualizada),
        matriculaTotalEadEqualizada: Number(m.matriculaTotalEadEqualizada),
        matriculaTotalEadMoocEqualizada: Number(m.matriculaTotalEadMoocEqualizada),
        matriculaTotalEadFpEqualizada: Number(m.matriculaTotalEadFpEqualizada),
      },
    ]),
  );
  const idsJaConhecidosViaPnp = new Set([
    ...mateqPorUnidade.filter((f) => f.unidadeId !== null).map((f) => f.unidadeId as number),
    ...campusElegiveisSemMatricula.map((u) => u.id),
  ]);
  // Câmpus com dado oficial mas sem PNP nem elegibilidade ao piso — só entram no Bloco
  // Funcionamento/Reitorias por causa do dado oficial (ver uso abaixo).
  const campusSoComOficial = matriculaOficialRows
    .filter((m) => !idsJaConhecidosViaPnp.has(m.unidadeId))
    .map((m) => ({ id: m.unidadeId, instituicaoId: m.unidade.instituicaoId }));
  // Rastreado à parte (não dá pra embutir em FuncionamentoInput, que é o tipo público de
  // blocoFuncionamento.ts) só para a memória de cálculo mostrar qual fonte foi usada por câmpus.
  const fontePorCampus = new Map<number, "oficial" | "placeholder">();

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

  // Fonte placeholder não tem quebra de modalidade disponível (a "Matrícula Equivalente | Geral"
  // da PNP já vem blendada) — tratada como já-blendada: vai inteira no denominador do Funcionamento,
  // sem adicional de EAD MOOC (mesma convenção usada por overrides do simulador, que também só
  // fornecem um número único).
  function resolverMatriculaPonderada(campusId: number, valorPlaceholder: number): MatriculaTotalEqualizadaPonderada {
    const registroOficial = matriculaOficialPorUnidade.get(campusId);
    if (registroOficial !== undefined) {
      fontePorCampus.set(campusId, "oficial");
      return calcularMatriculaTotalEqualizadaPonderada(registroOficial);
    }
    fontePorCampus.set(campusId, "placeholder");
    return { denominadorFuncionamento: valorPlaceholder, moocAdicionalFuncionamento: 0, pesoReitorias: valorPlaceholder };
  }

  const funcionamentoInputs = aplicarOverrideFuncionamento(
    [
      ...mateqPorUnidade
        .filter((f) => f.unidadeId !== null)
        .map((f) => {
          const ponderada = resolverMatriculaPonderada(f.unidadeId as number, Number(f._sum.valor ?? 0));
          return {
            campusId: f.unidadeId as number,
            matriculaPonderada: ponderada.denominadorFuncionamento,
            matriculaMoocAdicional: ponderada.moocAdicionalFuncionamento,
          };
        }),
      ...campusElegiveisSemMatricula.map((u) => {
        const ponderada = resolverMatriculaPonderada(u.id, 0);
        return {
          campusId: u.id,
          matriculaPonderada: ponderada.denominadorFuncionamento,
          matriculaMoocAdicional: ponderada.moocAdicionalFuncionamento,
        };
      }),
      ...campusSoComOficial.map((u) => {
        const ponderada = resolverMatriculaPonderada(u.id, 0);
        return {
          campusId: u.id,
          matriculaPonderada: ponderada.denominadorFuncionamento,
          matriculaMoocAdicional: ponderada.moocAdicionalFuncionamento,
        };
      }),
    ],
    overrides,
  );

  // Câmpus com valor sobrescrito pelo simulador não têm fonte real (não é oficial nem placeholder
  // — é hipotético); tratamos como "placeholder" na memória de cálculo por não termos uma 3ª
  // categoria pedida, e o valor sobrescrito já deixa isso implícito para quem está simulando.
  const qtdCampusPlaceholder = Array.from(fontePorCampus.values()).filter((f) => f === "placeholder").length;
  if (qtdCampusPlaceholder > 0) {
    console.warn(
      `[runCalculation] Bloco Funcionamento: ${qtdCampusPlaceholder} de ${fontePorCampus.size} câmpus sem Matrícula Total equalizada oficial para o ano-base ${anoOficial} — usando "Matrícula Equivalente | Geral" (PNP) como placeholder para esses câmpus (ver /admin/dados-anuais).`,
    );
  }

  // Bloco Reitorias usa a mesma base do Bloco Funcionamento (matrícula ponderada
  // pós-override), só que agregada por instituição — ver blocoReitorias.ts.
  const instituicaoIdPorCampus = new Map([
    ...mateqPorUnidade
      .filter((f) => f.unidadeId !== null)
      .map((f): [number, number] => [f.unidadeId as number, f.instituicaoId]),
    ...campusElegiveisSemMatricula.map((u): [number, number] => [u.id, u.instituicaoId]),
    ...campusSoComOficial.map((u): [number, number] => [u.id, u.instituicaoId]),
  ]);
  // O Bloco Reitorias trata EAD MOOC normalmente (peso 0,8, sem o tratamento aditivo/não-diluidor
  // do Funcionamento) — por isso soma matriculaPonderada + matriculaMoocAdicional aqui, e não só
  // matriculaPonderada (confirmado contra a planilha: bate exato com essa soma, ver
  // matriculaTotalEqualizada.ts § pesoReitorias).
  const reitoriaInputs = funcionamentoInputs
    .map((f) => {
      const instituicaoId = instituicaoIdPorCampus.get(f.campusId);
      return instituicaoId !== undefined
        ? { instituicaoId, matriculaPonderada: f.matriculaPonderada + (f.matriculaMoocAdicional ?? 0) }
        : null;
    })
    .filter((r): r is { instituicaoId: number; matriculaPonderada: number } => r !== null);

  // Fonte agregada por instituição (para a memória de cálculo do Bloco Reitorias) — "oficial" só
  // quando TODOS os câmpus da instituição usaram o dado oficial, "mista" quando há mistura.
  const fonteMatriculaPorInstituicao = new Map<number, "oficial" | "placeholder" | "mista">();
  for (const [campusId, instituicaoId] of instituicaoIdPorCampus) {
    const fonteCampus = fontePorCampus.get(campusId) ?? "placeholder";
    const atual = fonteMatriculaPorInstituicao.get(instituicaoId);
    if (atual === undefined) fonteMatriculaPorInstituicao.set(instituicaoId, fonteCampus);
    else if (atual !== fonteCampus) fonteMatriculaPorInstituicao.set(instituicaoId, "mista");
  }

  const ieaFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "EFICIENCIA_ACADEMICA",
      medida: { in: Object.keys(EFICIENCIA_CAMPO_POR_MEDIDA) },
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
  });
  // Contagens absolutas por câmpus — a soma por instituição e o cálculo do IEA (uma vez, no nível
  // da instituição) acontecem dentro de calcularBlocoIea.ts, nunca aqui.
  let ieaPorUnidade = new Map<number, IeaInput>();
  for (const fato of ieaFatos) {
    const unidadeId = fato.unidadeId as number;
    const atual = ieaPorUnidade.get(unidadeId) ?? {
      campusId: unidadeId,
      instituicaoId: fato.instituicaoId,
      concluidos: 0,
      evadidos: 0,
      retidos: 0,
    };
    const campo = EFICIENCIA_CAMPO_POR_MEDIDA[fato.medida as keyof typeof EFICIENCIA_CAMPO_POR_MEDIDA];
    atual[campo] += Number(fato.valor);
    ieaPorUnidade.set(unidadeId, atual);
  }
  const ieaInputs = Array.from(ieaPorUnidade.values());
  const ieaOverridesSimulador = construirOverridesIea(overrides, instituicaoIdPorCampus);

  const professorEquivalenteFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
      medida: MEDIDA_PROFESSOR_EQUIVALENTE,
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
  });
  // APROXIMAÇÃO: o numerador oficial do RAP Presencial (Portaria SETEC/MEC nº 51/2018, Art. 5º) é
  // a Matrícula-equivalente presencial — granularidade não disponível hoje. Usamos a matrícula
  // bruta presencial de TaxaEvasao.csv (único CSV com ModalidadeEnsino por curso) como
  // aproximação; erro esperado entre +0,9% e +53% por instituição (ver calcularBlocoRap.ts para o
  // detalhe da validação). O denominador (Professor Equivalente, acima) já está correto.
  const matriculasPresenciaisFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "TAXA_EVASAO",
      medida: MEDIDA_NUMERO_MATRICULAS,
      ano: input.ano,
      instituicaoId: { in: input.instituicaoIds },
      unidadeId: { not: null },
    },
    select: { unidadeId: true, instituicaoId: true, valor: true, dimensoesExtra: true },
  });

  // Matrículas presenciais e Professor Equivalente por câmpus — a soma por instituição e a
  // divisão (RAP, uma vez, no nível da instituição) acontecem dentro de calcularBlocoRap.ts, nunca
  // aqui.
  let rapPorUnidade = new Map<number, RapInput>();
  for (const fato of professorEquivalenteFatos) {
    const unidadeId = fato.unidadeId as number;
    const atual = rapPorUnidade.get(unidadeId) ?? {
      campusId: unidadeId,
      instituicaoId: fato.instituicaoId,
      matriculasPresenciais: 0,
      professorEquivalente: 0,
    };
    atual.professorEquivalente += Number(fato.valor);
    rapPorUnidade.set(unidadeId, atual);
  }
  for (const fato of matriculasPresenciaisFatos) {
    const modalidade = (fato.dimensoesExtra as { modalidadeEnsino?: string } | null)?.modalidadeEnsino;
    if (modalidade !== MODALIDADE_PRESENCIAL) continue;
    const unidadeId = fato.unidadeId as number;
    const atual = rapPorUnidade.get(unidadeId) ?? {
      campusId: unidadeId,
      instituicaoId: fato.instituicaoId,
      matriculasPresenciais: 0,
      professorEquivalente: 0,
    };
    atual.matriculasPresenciais += Number(fato.valor);
    rapPorUnidade.set(unidadeId, atual);
  }
  const rapInputs = Array.from(rapPorUnidade.values());
  const rapOverridesSimulador = construirOverridesRap(overrides, instituicaoIdPorCampus);

  // RAP Presencial oficial (RAPP) — cadastrado por instituição/ano-base em /admin/dados-anuais (ver
  // RappAnual). Quando existe para `anoOficial`, substitui a razão docente/aluno aproximada acima
  // (mesmo mecanismo de override já usado pelo simulador, ver calcularBlocoRap.ts) — pula a
  // aproximação via TaxaEvasao.csv por completo para essa instituição. Quando NÃO existe, a
  // instituição continua na aproximação (`rapInputs` acima). Um override explícito do simulador
  // sempre tem prioridade sobre o valor oficial (é um cenário hipotético deliberado).
  const rappOficialPorInstituicao = new Map<number, number>(
    (
      await prisma.rappAnual.findMany({
        where: { ano: anoOficial, instituicaoId: { in: input.instituicaoIds } },
      })
    ).map((r) => [r.instituicaoId, Number(r.rapp)]),
  );
  const fonteRapPorInstituicao = new Map<number, "oficial" | "aproximado">(
    input.instituicaoIds.map((id) => [id, rappOficialPorInstituicao.has(id) ? "oficial" : "aproximado"]),
  );
  const rapOverridesPorInstituicao = new Map([...rappOficialPorInstituicao, ...rapOverridesSimulador]);

  // Eficiência Acadêmica oficial (Conclusão/Evasão/Retenção de Ciclo, INDICADORES!G:J) — cadastrada
  // por instituição/ano-base em /admin/dados-anuais (ver EficienciaAcademicaAnual). Quando existe
  // para `anoOficial`, substitui integralmente a agregação aproximada de
  // Concluídos/Evadidos/Retidos acima (mesmo mecanismo de override que o simulador já tinha, ver
  // calcularBlocoIea.ts) — pula a agregação por completo para essa instituição. Quando NÃO existe, a
  // instituição continua na agregação aproximada (`ieaInputs` acima, com o erro de agregação já
  // documentado — ver tests/integration/goldenDataset.test.ts). Um override explícito do simulador
  // sempre tem prioridade sobre o valor oficial (é um cenário hipotético deliberado).
  const eficienciaOficialPorInstituicao = new Map<number, number>(
    (
      await prisma.eficienciaAcademicaAnual.findMany({
        where: { ano: anoOficial, instituicaoId: { in: input.instituicaoIds } },
      })
    ).map((r) => [r.instituicaoId, Number(r.eficienciaAcademica)]),
  );
  const fonteIeaPorInstituicao = new Map<number, "oficial" | "aproximado">(
    input.instituicaoIds.map((id) => [id, eficienciaOficialPorInstituicao.has(id) ? "oficial" : "aproximado"]),
  );
  const ieaOverridesPorInstituicao = new Map([...eficienciaOficialPorInstituicao, ...ieaOverridesSimulador]);

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
      matriculasGeral: 0,
    };
    const campo = IAPL_CAMPO_POR_MEDIDA[fato.medida as keyof typeof IAPL_CAMPO_POR_MEDIDA];
    atual[campo] += Number(fato.valor);
    iaplPorUnidade.set(unidadeId, atual);
  }
  iaplPorUnidade = aplicarOverrideIapl(iaplPorUnidade, overrides, instituicaoIdPorCampus);
  const iaplInputs = Array.from(iaplPorUnidade.values());

  // Faixa de RFP (Renda Familiar Per Capita) só existe por instituição na PNP real
  // (ClassificacaoRacialRendaSexo.csv não tem unidadeId) — ver blocoAssistenciaEstudantil.ts.
  // NÃO VALIDADO CONTRA A PLANILHA OFICIAL: o rótulo da faixa bate com a metodologia, mas o VR
  // resultante nunca foi conferido contra a planilha nem confirmado com CONIF/SETEC (ver aviso
  // em blocoAssistenciaEstudantil.ts e AssistenciaEstudantilRfpInput).
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

  // Piso Mínimo por Câmpus Novo: só afeta o Bloco Funcionamento (Reitorias/Qualidade e
  // Eficiência continuam usando a Matrícula Ponderada crua, sem o piso — ver blocoReitorias.ts).
  const unidadesAnoCriacao = await prisma.unidade.findMany({
    where: { id: { in: funcionamentoInputs.map((f) => f.campusId) } },
    select: { id: true, anoCriacao: true },
  });
  const anoCriacaoPorCampus = new Map(unidadesAnoCriacao.map((u) => [u.id, u.anoCriacao]));
  const funcionamento = aplicarPisoMinimoCampusNovo(
    blocoFuncionamento(funcionamentoInputs, baseCalculoPercentuais),
    anoCriacaoPorCampus,
    input.pisoMinimoCampusNovo ?? 0,
  );
  const reitorias = blocoReitorias(reitoriaInputs, baseCalculoPercentuais);
  const qualidadeEficiencia = blocoQualidadeEficiencia(
    ieaInputs,
    rapInputs,
    iaplInputs,
    baseCalculoPercentuais,
    ieaOverridesPorInstituicao,
    rapOverridesPorInstituicao,
    estrategiaFaixasIea,
  );
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
    calcularBlocoIea(ieaInputs, baseCalculoPercentuais, ieaOverridesPorInstituicao, estrategiaFaixasIea).map((d) => [
      d.instituicaoId,
      d,
    ]),
  );
  const rapDetalhePorInstituicao = new Map(
    calcularBlocoRap(rapInputs, baseCalculoPercentuais, rapOverridesPorInstituicao).map((d) => [d.instituicaoId, d]),
  );
  const iaplDetalhePorInstituicao = new Map(
    calcularBlocoIapl(iaplInputs, baseCalculoPercentuais).map((d) => [d.instituicaoId, d]),
  );

  const parametersSnapshot = {
    instituicaoIds: input.instituicaoIds,
    escopo: input.escopo ?? null,
    ano: input.ano,
    anoOrcamento: input.anoOrcamento ?? null,
    orcamentoTotal: input.orcamentoTotal,
    ajuste: input.ajuste ?? 0,
    baseCalculoPercentuais,
    orcamentoAssistenciaEstudantil: input.orcamentoAssistenciaEstudantil ?? 0,
    percentualAnuidade: input.percentualAnuidade ?? 0,
    pisoMinimoCampusNovo: input.pisoMinimoCampusNovo ?? 0,
    estrategiaFaixasIea,
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
    ...funcionamento.map((f) => {
      const fonteMatricula = fontePorCampus.get(f.campusId) ?? "placeholder";
      const registroOficial = matriculaOficialPorUnidade.get(f.campusId);
      return {
        runId: run.id,
        campusId: f.campusId,
        bloco: "FUNCIONAMENTO" as const,
        metrica: "valorReais",
        valor: f.valorReais,
        detalhe: {
          fonteMatricula,
          matriculaOficialPresencial: registroOficial?.matriculaTotalPresencialEqualizada,
          matriculaOficialEad: registroOficial?.matriculaTotalEadEqualizada,
          matriculaOficialEadMooc: registroOficial?.matriculaTotalEadMoocEqualizada,
          matriculaOficialEadFp: registroOficial?.matriculaTotalEadFpEqualizada,
          matriculaPonderadaCampus: f.totalMatriculaPonderada,
          totalMatriculaPonderadaRede,
          matriculasBrutasCampus: matriculasBrutasPorCampus.get(f.campusId) ?? 0,
          totalMatriculasBrutasRede,
          share: f.share,
          pesoBloco: PESO_BLOCO_FUNCIONAMENTO,
          valorBlocoRede: PESO_BLOCO_FUNCIONAMENTO * baseCalculoPercentuais,
          // Taxa (MTP, R$/ponto ponderado) e o adicional de EAD MOOC — pago à mesma MTP, mas somado
          // depois de calculada (não dilui a taxa dos demais câmpus da rede). Ver
          // matriculaTotalEqualizada.ts / blocoFuncionamento.ts.
          mtp: f.mtp,
          valorMoocAdicional: f.valorMoocAdicional,
          pisoMinimoCampusNovo: input.pisoMinimoCampusNovo ?? 0,
          pisoAplicado: f.pisoAplicado,
          valorAntesDoPiso: f.valorAntesDoPiso,
          valorReais: f.valorReais,
        },
      };
    }),
    ...reitorias.map((r) => ({
      runId: run.id,
      campusId: null,
      bloco: "REITORIAS" as const,
      metrica: `valorReais_autarquia_${r.autarquiaId}`,
      valor: r.valorReais,
      detalhe: {
        fonteMatricula: fonteMatriculaPorInstituicao.get(r.autarquiaId) ?? "placeholder",
        numeroInstituicoes: input.instituicaoIds.length,
        matriculaPonderadaInstituicao: r.totalMatriculaPonderada,
        totalMatriculaPonderadaRede,
        share: r.share,
        pesoBloco: PESO_BLOCO_REITORIAS,
        valorBlocoRede: PESO_BLOCO_REITORIAS * baseCalculoPercentuais,
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
                fonte: fonteIeaPorInstituicao.get(q.instituicaoId) ?? "aproximado",
                porCampus: ieaD.porCampus,
                concluidos: ieaD.concluidos,
                evadidos: ieaD.evadidos,
                retidos: ieaD.retidos,
                cCiclo: ieaD.cCiclo,
                evCiclo: ieaD.evCiclo,
                rCiclo: ieaD.rCiclo,
                valorIea: ieaD.valorIea,
                estrategia: ieaD.estrategia,
                band: ieaD.band,
                peso: ieaD.peso,
                ponderadoInstituicao: ieaD.ponderado,
                somaPonderadosRede: ieaD.somaPonderadosRede,
                share: ieaD.share,
                pesoSubBloco: PESO_IEA_SUBBLOCO,
                valorSubBlocoRede: PESO_IEA_SUBBLOCO * baseCalculoPercentuais,
                valorReais: ieaD.valorReais,
              }
            : null,
          rap: rapD
            ? {
                fonte: fonteRapPorInstituicao.get(q.instituicaoId) ?? "aproximado",
                porCampus: rapD.porCampus,
                matriculasPresenciais: rapD.matriculasPresenciais,
                professorEquivalente: rapD.professorEquivalente,
                razaoDocenteAluno: rapD.razaoDocenteAluno,
                band: rapD.band,
                peso: rapD.peso,
                ponderadoInstituicao: rapD.ponderado,
                somaPonderadosRede: rapD.somaPonderadosRede,
                share: rapD.share,
                pesoSubBloco: PESO_RAP_SUBBLOCO,
                valorSubBlocoRede: PESO_RAP_SUBBLOCO * baseCalculoPercentuais,
                valorReais: rapD.valorReais,
              }
            : null,
          iapl: iaplD
            ? {
                tecnicos: {
                  matriculas: iaplD.tecnicos.matriculas,
                  matriculasGeral: iaplD.tecnicos.matriculasGeral,
                  percentualMe: iaplD.tecnicos.percentualMe,
                  peso: iaplD.tecnicos.peso,
                  ponderado: iaplD.tecnicos.ponderado,
                  somaPonderadosRede: iaplD.tecnicos.somaPonderadosRede,
                  share: iaplD.tecnicos.share,
                  valorCategoriaRede: PESO_IAPL_SUBBLOCO * baseCalculoPercentuais * IAPL_SPLIT.CURSOS_TECNICOS,
                  valorReais: iaplD.tecnicos.valorReais,
                },
                formacaoProfessores: {
                  matriculas: iaplD.formacaoProfessores.matriculas,
                  matriculasGeral: iaplD.formacaoProfessores.matriculasGeral,
                  percentualMe: iaplD.formacaoProfessores.percentualMe,
                  peso: iaplD.formacaoProfessores.peso,
                  ponderado: iaplD.formacaoProfessores.ponderado,
                  somaPonderadosRede: iaplD.formacaoProfessores.somaPonderadosRede,
                  share: iaplD.formacaoProfessores.share,
                  valorCategoriaRede: PESO_IAPL_SUBBLOCO * baseCalculoPercentuais * IAPL_SPLIT.FORMACAO_PROFESSORES,
                  valorReais: iaplD.formacaoProfessores.valorReais,
                },
                proeja: {
                  matriculas: iaplD.proeja.matriculas,
                  matriculasGeral: iaplD.proeja.matriculasGeral,
                  percentualMe: iaplD.proeja.percentualMe,
                  peso: iaplD.proeja.peso,
                  ponderado: iaplD.proeja.ponderado,
                  somaPonderadosRede: iaplD.proeja.somaPonderadosRede,
                  share: iaplD.proeja.share,
                  valorCategoriaRede: PESO_IAPL_SUBBLOCO * baseCalculoPercentuais * IAPL_SPLIT.PROEJA,
                  valorReais: iaplD.proeja.valorReais,
                },
                pesoSubBloco: PESO_IAPL_SUBBLOCO,
                valorSubBlocoRede: PESO_IAPL_SUBBLOCO * baseCalculoPercentuais,
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
