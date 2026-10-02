import { simularOpcaoCurso, type OpcaoCurso } from "@/lib/mdo/simulacaoCurso";
import { ganhoDoIndicador, type IndicadorSimulavel, type IndicadoresDaInstituicao } from "@/lib/simulacaoIndicadores";

/**
 * Comparador de alternativas: tudo que um câmpus pode fazer para receber mais (abrir um curso, mudar a duração de um
 * curso, subir um indicador, reduzir a evasão, ocupar mais vagas), reduzido à mesma medida, o ganho em reais por ano,
 * para poder pôr lado a lado "o que rende mais". Funções puras.
 *
 * Todas as alternativas medem o ganho EM CIMA do que o câmpus já recebe: um curso novo soma o repasse das turmas dele; um
 * indicador soma a diferença que a faixa nova faz no bloco; a evasão e a matrícula somam uma fração do que há hoje.
 */

export interface ContextoAlternativas {
  /** Valor de uma matrícula no ciclo base, tirado dos ciclos do câmpus. */
  valorMatricula: number;
  /** Ciclo de onde vem o valor da matrícula. */
  anoDoValor: number;
  /** Reajuste anual do valor da matrícula (0,05 = 5% ao ano); zero é a hipótese conservadora. */
  reajusteAnual: number;
  /** O que o câmpus recebe hoje em Funcionamento. */
  orcamentoCampusHoje: number;
  /** O que o câmpus perde hoje por evasão. */
  perdaCampus: number;
  /** Alunos do câmpus hoje (Qtd. Alunos da MDO). */
  alunosCampus: number;
  indicadores: IndicadoresDaInstituicao;
}

interface Base {
  id: string;
  rotulo: string;
  /** Primeiro ano em que a alternativa passa a valer. */
  primeiroAno: number;
}

export interface AlternativaCurso extends Base {
  tipo: "CURSO";
  opcao: OpcaoCurso;
  peso: number;
  /** Chave do curso de referência no catálogo (só para a tela lembrar qual foi escolhido; não entra na conta). */
  referencia?: string;
}

export interface AlternativaIndicador extends Base {
  tipo: "INDICADOR";
  indicador: IndicadorSimulavel;
  novoValor: number;
}

export interface AlternativaEvasao extends Base {
  tipo: "EVASAO";
  /** Quanto da perda atual por evasão deixa de existir (0 a 100). */
  reducaoPct: number;
}

export interface AlternativaMatricula extends Base {
  tipo: "MATRICULA";
  /** Quanto cresce a matrícula dos cursos que já existem (0 a 100). */
  crescimentoPct: number;
}

export type Alternativa = AlternativaCurso | AlternativaIndicador | AlternativaEvasao | AlternativaMatricula;

export interface ResultadoAlternativa {
  id: string;
  rotulo: string;
  tipo: Alternativa["tipo"];
  primeiroAno: number;
  /** Ganho de cada ano do eixo (mesma ordem e tamanho de `anos`). */
  ganhoPorAno: number[];
  /** Ganho do último ano do eixo, que representa o ritmo de cruzeiro quando o horizonte é longo o bastante. */
  ganhoNoUltimoAno: number;
  acumulado: number;
  /** Alunos que a alternativa exige a mais (um curso novo, ou ocupar vagas); zero para indicador e evasão. */
  alunosNovos: number;
  /** Primeiro ano do eixo com ganho maior que zero, ou null. */
  anoDoPrimeiroGanho: number | null;
  /** Ganho por ano por aluno novo, no último ano; null quando não há aluno novo. */
  ganhoPorAlunoNovo: number | null;
}

export function eixoDeAnos(anoInicial: number, horizonte: number): number[] {
  return Array.from({ length: horizonte }, (_, i) => anoInicial + i);
}

export function resultadoDaAlternativa(alt: Alternativa, ctx: ContextoAlternativas, anos: number[]): ResultadoAlternativa {
  const ultimo = anos[anos.length - 1]!;
  let ganhoPorAno: number[] = anos.map(() => 0);
  let alunosNovos = 0;

  if (alt.tipo === "CURSO") {
    // O horizonte vai até o fim do eixo; antes da primeira entrada o ganho é zero.
    const horizonte = Math.max(1, ultimo - alt.primeiroAno + 1);
    const r = simularOpcaoCurso(alt.opcao, {
      peso: alt.peso,
      agropecuaria: false,
      valorMatricula: ctx.valorMatricula,
      anoInicial: alt.primeiroAno,
      horizonteAnos: horizonte,
      reajusteAnual: ctx.reajusteAnual,
      anoDoValor: ctx.anoDoValor,
    });
    const porAno = new Map(r.linhas.map((l) => [l.ano, l.valor]));
    ganhoPorAno = anos.map((a) => porAno.get(a) ?? 0);
    alunosNovos = r.regime.alunosAtivos;
  } else if (alt.tipo === "INDICADOR") {
    const ganho = ganhoDoIndicador(alt.indicador, alt.novoValor, ctx.indicadores);
    ganhoPorAno = anos.map((a) => (a >= alt.primeiroAno ? ganho : 0));
  } else if (alt.tipo === "EVASAO") {
    const ganho = ctx.perdaCampus * (alt.reducaoPct / 100);
    ganhoPorAno = anos.map((a) => (a >= alt.primeiroAno ? ganho : 0));
  } else {
    const ganho = ctx.orcamentoCampusHoje * (alt.crescimentoPct / 100);
    ganhoPorAno = anos.map((a) => (a >= alt.primeiroAno ? ganho : 0));
    alunosNovos = ctx.alunosCampus * (alt.crescimentoPct / 100);
  }

  const ganhoNoUltimoAno = ganhoPorAno[ganhoPorAno.length - 1] ?? 0;
  const indicePrimeiro = ganhoPorAno.findIndex((g) => g > 0);
  return {
    id: alt.id,
    rotulo: alt.rotulo,
    tipo: alt.tipo,
    primeiroAno: alt.primeiroAno,
    ganhoPorAno,
    ganhoNoUltimoAno,
    acumulado: ganhoPorAno.reduce((s, g) => s + g, 0),
    alunosNovos,
    anoDoPrimeiroGanho: indicePrimeiro >= 0 ? anos[indicePrimeiro]! : null,
    ganhoPorAlunoNovo: alunosNovos > 0 ? ganhoNoUltimoAno / alunosNovos : null,
  };
}

/** A melhor alternativa pelo acumulado, e a que começa a render mais cedo (a de maior ganho acumulado entre as mais cedo). */
export function melhores(resultados: ResultadoAlternativa[]): { maisRende: ResultadoAlternativa | null; maisRapida: ResultadoAlternativa | null } {
  const comGanho = resultados.filter((r) => r.acumulado > 0);
  if (comGanho.length === 0) return { maisRende: null, maisRapida: null };
  const maisRende = [...comGanho].sort((a, b) => b.acumulado - a.acumulado)[0]!;
  const primeiro = Math.min(...comGanho.map((r) => r.anoDoPrimeiroGanho ?? Infinity));
  const maisRapida = [...comGanho.filter((r) => r.anoDoPrimeiroGanho === primeiro)].sort((a, b) => b.acumulado - a.acumulado)[0] ?? null;
  return { maisRende, maisRapida };
}
