import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { nomeCanonicoDaUnidade } from "@/lib/nomesDeUnidade";
import {
  colunasDaQuartaFase,
  COLUNAS_QUARTA_FASE,
  matriculaTotalPeloMotor,
  valorDaColuna,
  type ChaveColuna,
  type ColunasQuartaFase,
  type EntradaQuartaFase,
} from "@/lib/mdo/quartaFase";

/**
 * Dados da tela "Conferência da 4ª fase": cada linha da planilha, as colunas refeitas com as fórmulas do Excel, a Matrícula
 * Total pelo motor do sistema e, conforme o arquivo, a referência para comparar:
 *  - a planilha que a DDI salvou no Excel traz os resultados gravados: compara coluna a coluna com eles;
 *  - a exportação da MDO vem só com fórmulas: compara a Matrícula Total com a que a MDO publicou na 6ª fase do mesmo ciclo.
 */

const TOLERANCIA = 1e-6;

export interface ArquivoQuartaFase {
  id: number;
  arquivo: string;
  ciclo: number;
  geradoEm: Date | null;
  carregadoEm: Date;
  ressalva: string | null;
  linhas: number;
  /** O Excel gravou os resultados das fórmulas (a planilha da DDI); a exportação da MDO vem sem eles. */
  temResultados: boolean;
}

export interface ReferenciaSextaFase {
  matriculaTotal: number;
  alunos: number;
  peso: number | null;
  chMec: number | null;
  /** Soma da Matrícula Total que as linhas da 4ª fase deste ciclo dão (a exportação repete alguns ciclos em duas linhas). */
  somaDasLinhas: number;
  linhasNaQuartaFase: number;
  confere: boolean;
  /** O que a 6ª fase aplicou diferente da 4ª fase, quando não confere. */
  motivos: string[];
}

export interface LinhaConferida {
  id: number;
  linha: number;
  unidade: string;
  codigoCiclo: string;
  nomeCiclo: string | null;
  curso: string;
  tipoCurso: string;
  tipoOferta: string;
  situacao: string;
  entrada: EntradaQuartaFase;
  colunas: ColunasQuartaFase;
  mtMotor: number;
  /** Os resultados gravados pelo Excel; nulo quando o arquivo veio só com fórmulas. */
  planilha: Record<ChaveColuna, number> | null;
  /** Colunas em que o resultado gravado difere da fórmula refeita. */
  colunasDiferentes: ChaveColuna[];
  sextaFase: ReferenciaSextaFase | null;
  /** A linha confere com a referência do arquivo (todas as colunas da planilha, ou a 6ª fase). */
  confere: boolean;
}

export interface ResumoUnidade {
  unidade: string;
  /** Alunos (QTM) por situação, somados das linhas. */
  alunos: Record<string, number>;
  /** Matrícula Total por situação, refeita pelo sistema. */
  mt: Record<string, number>;
  /** O que a aba "Instituíção" do arquivo traz, quando o Excel gravou. */
  planilha: { alunos: Record<string, number>; mt: Record<string, number> } | null;
  /** Matrícula Total que a MDO publicou na 6ª fase para a unidade (só quando o arquivo não tem resultados). */
  mtSextaFase: number | null;
  confere: boolean | null;
}

export interface ConferenciaQuartaFase {
  arquivo: ArquivoQuartaFase;
  temResultados: boolean;
  linhas: LinhaConferida[];
  unidades: ResumoUnidade[];
  totais: {
    linhas: number;
    linhasQueConferem: number;
    colunasConferidas: number;
    motorIgualFormulas: number;
    mtPlanilha: number | null;
    mtSistema: number;
    mtSextaFase: number | null;
    ciclosNaSextaFase: number;
    ciclosQueConferemSextaFase: number;
  };
}

export const SITUACOES = ["PRESENCIAL", "EAD", "EAD MOOC", "EAD FP"] as const;
const REPASSE_DA_SITUACAO: Record<string, string> = { PRESENCIAL: "PRESENCIAL", EAD: "EAD", "EAD MOOC": "EAD_MOOC", "EAD FP": "EAD_FP" };

export async function arquivosQuartaFase(): Promise<ArquivoQuartaFase[]> {
  const fontes = await prisma.fonteDados.findMany({
    where: { fase: "F4_CHECAGEM_MATRICULAS" },
    select: { id: true, arquivo: true, cicloOrcamento: true, geradoEm: true, carregadoEm: true, ressalva: true, _count: { select: { quartaFaseCiclos: true } } },
    orderBy: [{ cicloOrcamento: "asc" }, { id: "asc" }],
  });
  const comResultados = new Set(
    (
      await prisma.quartaFaseCiclo.groupBy({ by: ["fonteDadosId"], where: { resultadosPlanilha: { not: Prisma.DbNull } } })
    ).map((g) => g.fonteDadosId),
  );
  return fontes
    .filter((f) => f._count.quartaFaseCiclos > 0)
    .map((f) => ({
      id: f.id,
      arquivo: f.arquivo,
      ciclo: f.cicloOrcamento,
      geradoEm: f.geradoEm,
      carregadoEm: f.carregadoEm,
      ressalva: f.ressalva,
      linhas: f._count.quartaFaseCiclos,
      temResultados: comResultados.has(f.id),
    }));
}

export async function conferenciaQuartaFase(arquivo: ArquivoQuartaFase): Promise<ConferenciaQuartaFase> {
  const brutas = await prisma.quartaFaseCiclo.findMany({ where: { fonteDadosId: arquivo.id }, orderBy: { linha: "asc" } });
  const temResultados = arquivo.temResultados;

  const linhas: LinhaConferida[] = brutas.map((b) => {
    const entrada: EntradaQuartaFase = {
      tipoCurso: b.tipoCurso,
      tipoOferta: b.tipoOferta,
      agropecuaria: b.agropecuaria,
      inicio: b.inicio,
      termino: b.termino,
      chCiclo: b.chCiclo,
      chMec: b.chMec,
      peso: Number(b.peso),
      inicioPeriodo: b.inicioPeriodo,
      fimPeriodo: b.fimPeriodo,
      matriculas: Number(b.matriculas),
    };
    const colunas = colunasDaQuartaFase(entrada);
    const planilha = (b.resultadosPlanilha as Record<ChaveColuna, number> | null) ?? null;
    const colunasDiferentes = planilha
      ? COLUNAS_QUARTA_FASE.filter((c) => Math.abs(valorDaColuna(colunas, c.chave) - (planilha[c.chave] ?? 0)) > TOLERANCIA).map((c) => c.chave)
      : [];
    return {
      id: b.id,
      linha: b.linha,
      unidade: b.unidade,
      codigoCiclo: b.codigoCiclo,
      nomeCiclo: b.nomeCiclo,
      curso: b.curso,
      tipoCurso: b.tipoCurso,
      tipoOferta: b.tipoOferta,
      situacao: b.situacao,
      entrada,
      colunas,
      mtMotor: matriculaTotalPeloMotor(entrada),
      planilha,
      colunasDiferentes,
      sextaFase: null,
      confere: planilha ? colunasDiferentes.length === 0 : false,
    };
  });

  // Sem resultados gravados, a referência é a 6ª fase do mesmo ciclo orçamentário, pelo código do ciclo.
  let ciclosNaSextaFase = 0;
  let ciclosQueConferemSextaFase = 0;
  let mtSextaFaseTotal: number | null = null;
  const mtSextaPorUnidade = new Map<string, number>();
  if (!temResultados) {
    const publicados = await prisma.distribuicaoCiclo.findMany({
      where: { ano: arquivo.ciclo, codigoCiclo: { in: [...new Set(linhas.map((l) => l.codigoCiclo))] } },
      select: { codigoCiclo: true, matriculaTotal: true, qtdAlunosMatriz: true, pesoCursoMatriz: true, chMinimaMec: true, unidade: { select: { nome: true } } },
    });
    const porCodigo = new Map<string, LinhaConferida[]>();
    for (const l of linhas) porCodigo.set(l.codigoCiclo, [...(porCodigo.get(l.codigoCiclo) ?? []), l]);
    mtSextaFaseTotal = 0;
    for (const p of publicados) {
      const doCiclo = porCodigo.get(p.codigoCiclo);
      if (!doCiclo) continue;
      const mt = Number(p.matriculaTotal);
      mtSextaFaseTotal += mt;
      const chave = nomeCanonicoDaUnidade(p.unidade.nome);
      mtSextaPorUnidade.set(chave, (mtSextaPorUnidade.get(chave) ?? 0) + mt);
      const somaDasLinhas = doCiclo.reduce((s, l) => s + l.mtMotor, 0);
      const confere = Math.abs(somaDasLinhas - mt) < 1e-3;
      const primeira = doCiclo[0]!.entrada;
      const peso = p.pesoCursoMatriz === null ? null : Number(p.pesoCursoMatriz);
      const alunos = Number(p.qtdAlunosMatriz ?? 0);
      const motivos: string[] = [];
      if (!confere) {
        if (peso !== null && Math.abs(peso - primeira.peso) > TOLERANCIA) motivos.push(`peso: ${numero(primeira.peso)} na 4ª fase, ${numero(peso)} aplicado na 6ª fase`);
        if (p.chMinimaMec !== null && p.chMinimaMec !== primeira.chMec) motivos.push(`CH mínima do MEC: ${numero(primeira.chMec)} h na 4ª fase, ${numero(p.chMinimaMec)} h na 6ª fase`);
        const alunosQuarta = doCiclo.reduce((s, l) => s + l.entrada.matriculas, 0);
        if (Math.abs(alunos - alunosQuarta) > TOLERANCIA) motivos.push(`alunos: ${numero(alunosQuarta)} na 4ª fase, ${numero(alunos)} na 6ª fase`);
      }
      ciclosNaSextaFase++;
      if (confere) ciclosQueConferemSextaFase++;
      const referencia: ReferenciaSextaFase = { matriculaTotal: mt, alunos, peso, chMec: p.chMinimaMec, somaDasLinhas, linhasNaQuartaFase: doCiclo.length, confere, motivos };
      for (const l of doCiclo) {
        l.sextaFase = referencia;
        l.confere = confere;
      }
    }
  }

  // Resumo por unidade, como a aba "Instituíção".
  const resumoPlanilha = await prisma.quartaFaseUnidade.findMany({ where: { fonteDadosId: arquivo.id }, orderBy: { linha: "asc" } });
  const porUnidade = new Map<string, ResumoUnidade>();
  const ordem = resumoPlanilha.map((r) => r.unidade);
  for (const l of linhas) if (!ordem.includes(l.unidade)) ordem.push(l.unidade);
  for (const nome of ordem) porUnidade.set(nome, { unidade: nome, alunos: {}, mt: {}, planilha: null, mtSextaFase: null, confere: null });
  for (const l of linhas) {
    const u = porUnidade.get(l.unidade)!;
    u.alunos[l.situacao] = (u.alunos[l.situacao] ?? 0) + l.entrada.matriculas;
    u.mt[l.situacao] = (u.mt[l.situacao] ?? 0) + l.colunas.mt;
  }
  const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
  for (const r of resumoPlanilha) {
    const u = porUnidade.get(r.unidade)!;
    if (temResultados) {
      u.planilha = {
        alunos: { PRESENCIAL: n(r.alunosPresencial), "PRESENCIAL FE": n(r.alunosPresencialFe), EAD: n(r.alunosEad), "EAD MOOC": n(r.alunosEadMooc), "EAD FP": n(r.alunosEadFp) },
        mt: { PRESENCIAL: n(r.mtPresencial), EAD: n(r.mtEad), "EAD MOOC": n(r.mtEadMooc), "EAD FP": n(r.mtEadFp) },
      };
      u.confere = SITUACOES.every((s) => Math.abs((u.mt[s] ?? 0) - u.planilha!.mt[s]!) < 1e-6);
    }
  }
  if (!temResultados) {
    for (const u of porUnidade.values()) {
      const pub = mtSextaPorUnidade.get(nomeCanonicoDaUnidade(u.unidade));
      u.mtSextaFase = pub ?? null;
    }
  }

  const mtSistema = linhas.reduce((s, l) => s + l.colunas.mt, 0);
  return {
    arquivo,
    temResultados,
    linhas,
    unidades: [...porUnidade.values()].filter((u) => Object.keys(u.alunos).length > 0 || u.planilha),
    totais: {
      linhas: linhas.length,
      linhasQueConferem: linhas.filter((l) => l.confere).length,
      colunasConferidas: COLUNAS_QUARTA_FASE.length,
      motorIgualFormulas: linhas.filter((l) => Math.abs(l.mtMotor - l.colunas.mt) < TOLERANCIA).length,
      mtPlanilha: temResultados ? linhas.reduce((s, l) => s + (l.planilha?.mt ?? 0), 0) : null,
      mtSistema,
      mtSextaFase: mtSextaFaseTotal,
      ciclosNaSextaFase,
      ciclosQueConferemSextaFase,
    },
  };
}

const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
function numero(v: number): string {
  return formatoNumero.format(v);
}
