/**
 * Valores "calculados" (aproximação a partir da PNP) para os indicadores que têm um equivalente
 * oficial cadastrado em Dados Anuais (RappAnual, EficienciaAcademicaAnual,
 * MatriculaTotalEqualizadaAnual) — expostos como coluna de comparação na tela pública
 * /dados-importados, ao lado do valor oficial (Planilha/Configurado). Reaproveita
 * calcularBlocoRap/calcularBlocoIea (mesma fórmula/aproximação de runCalculation.ts) chamando-os
 * SEM overrides, para que o resultado seja sempre a aproximação, mesmo quando já existe valor
 * oficial para a instituição. Custeio/Assistência Distribuído Oficial ficam de fora: o algoritmo da
 * trava de não-decréscimo não é reimplementado neste sistema (ver CusteioDistribuidoOficial no
 * schema), então não existe um "calculado" equivalente para comparar.
 */
import { prisma } from "@/server/db/prisma";
import { calcularBlocoRap } from "@/calculation-engine/qualidadeEficiencia/rap/calcularBlocoRap";
import { calcularBlocoIea } from "@/calculation-engine/qualidadeEficiencia/iea/calcularBlocoIea";
import type { RapInput, IeaInput } from "@/calculation-engine/types/qualidadeEficiencia.types";

const MEDIDA_MATRICULA_EQUIVALENTE_GERAL = "Matrícula Equivalente | Geral";
const MEDIDA_NUMERO_MATRICULAS = "Número de Matrículas";
const MEDIDA_PROFESSOR_EQUIVALENTE = "RAP | Professor Equivalente";
const MODALIDADE_PRESENCIAL = "Educação Presencial";

const EFICIENCIA_CAMPO_POR_MEDIDA = {
  "Eficiência Acadêmica | Concluídos": "concluidos",
  "Eficiência Acadêmica | Número de Evadidos": "evadidos",
  "Eficiência Acadêmica | Retidos": "retidos",
} as const satisfies Record<string, keyof Omit<IeaInput, "campusId" | "instituicaoId">>;

/**
 * Matrícula Equivalente | Geral bruta da PNP por câmpus — mesmo dado usado como placeholder em
 * runCalculation.ts (resolverMatriculaPonderada) quando não há Matrícula Total equalizada oficial
 * cadastrada para o câmpus/ano. Não é o mesmo cálculo de MatriculaTotalEqualizadaAnual (que soma
 * Presencial+EaD+EaDMOOC+EaDFP separados) — é o valor único que o motor usa na ausência do oficial.
 */
export async function buscarMatriculaEquivalenteGeralPorUnidade(
  anoPnp: number,
  unidadeIds: number[],
): Promise<Map<number, number>> {
  if (unidadeIds.length === 0) return new Map();

  const fatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "DADOS_GERAIS",
      medida: MEDIDA_MATRICULA_EQUIVALENTE_GERAL,
      ano: anoPnp,
      unidadeId: { in: unidadeIds },
    },
    select: { unidadeId: true, valor: true },
  });

  const mapa = new Map<number, number>();
  for (const fato of fatos) {
    if (fato.unidadeId === null) continue;
    mapa.set(fato.unidadeId, (mapa.get(fato.unidadeId) ?? 0) + Number(fato.valor));
  }
  return mapa;
}

export interface RapAproximado {
  matriculasPresenciais: number;
  professorEquivalente: number;
  razaoDocenteAluno: number;
}

/** RAP Presencial aproximado por instituição, com os números brutos que formam o cálculo (para a
 *  memória de cálculo didática exibida em /dados-importados) — mesma aproximação de
 *  calcularBlocoRap.ts, sem override. */
export async function calcularRapAproximadoPorInstituicao(
  anoPnp: number,
  instituicaoIds: number[],
): Promise<Map<number, RapAproximado>> {
  if (instituicaoIds.length === 0) return new Map();

  const [professorEquivalenteFatos, matriculasPresenciaisFatos] = await Promise.all([
    prisma.fatoIndicador.findMany({
      where: {
        fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
        medida: MEDIDA_PROFESSOR_EQUIVALENTE,
        ano: anoPnp,
        instituicaoId: { in: instituicaoIds },
        unidadeId: { not: null },
      },
    }),
    prisma.fatoIndicador.findMany({
      where: {
        fileType: "TAXA_EVASAO",
        medida: MEDIDA_NUMERO_MATRICULAS,
        ano: anoPnp,
        instituicaoId: { in: instituicaoIds },
        unidadeId: { not: null },
      },
      select: { unidadeId: true, instituicaoId: true, valor: true, dimensoesExtra: true },
    }),
  ]);

  const rapPorUnidade = new Map<number, RapInput>();
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

  const resultados = calcularBlocoRap(Array.from(rapPorUnidade.values()), 0);
  return new Map(
    resultados.map((r) => [
      r.instituicaoId,
      {
        matriculasPresenciais: r.matriculasPresenciais,
        professorEquivalente: r.professorEquivalente,
        razaoDocenteAluno: r.razaoDocenteAluno,
      },
    ]),
  );
}

export interface EficienciaAcademicaAproximada {
  concluidos: number;
  evadidos: number;
  retidos: number;
  conclusaoCiclo: number;
  evasaoCiclo: number;
  retencaoCiclo: number;
  eficienciaAcademica: number;
}

/** Concluídos/Evadidos/Retidos (contagens brutas), Conclusão/Evasão/Retenção de Ciclo e IEA
 *  aproximados por instituição, com os números que formam o cálculo (para a memória de cálculo
 *  didática exibida em /dados-importados) — mesma agregação de calcularBlocoIea.ts, sem override
 *  (ver ATENÇÃO de erro de agregação na docstring dessa função). */
export async function calcularEficienciaAcademicaAproximadaPorInstituicao(
  anoPnp: number,
  instituicaoIds: number[],
): Promise<Map<number, EficienciaAcademicaAproximada>> {
  if (instituicaoIds.length === 0) return new Map();

  const ieaFatos = await prisma.fatoIndicador.findMany({
    where: {
      fileType: "EFICIENCIA_ACADEMICA",
      medida: { in: Object.keys(EFICIENCIA_CAMPO_POR_MEDIDA) },
      ano: anoPnp,
      instituicaoId: { in: instituicaoIds },
      unidadeId: { not: null },
    },
  });

  const ieaPorUnidade = new Map<number, IeaInput>();
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

  const resultados = calcularBlocoIea(Array.from(ieaPorUnidade.values()), 0);
  return new Map(
    resultados.map((r) => [
      r.instituicaoId,
      {
        concluidos: r.concluidos,
        evadidos: r.evadidos,
        retidos: r.retidos,
        conclusaoCiclo: r.cCiclo,
        evasaoCiclo: r.evCiclo,
        retencaoCiclo: r.rCiclo,
        eficienciaAcademica: r.valorIea,
      },
    ]),
  );
}
