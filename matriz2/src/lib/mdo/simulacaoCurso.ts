import { matriculaTotalDoCiclo, type CicloParaCalculo } from "./matriculaTotal";

/**
 * Simulação de um curso ao longo dos anos, usando a MESMA regra da MDO para a
 * Matrícula Total (`matriculaTotal.ts`, conferida contra o Excel). A pergunta que ela
 * responde: "num câmpus, vale mais abrir uma turma de 3 anos ou de 4 anos?".
 *
 * O ponto que costuma passar despercebido, e que a simulação deixa à vista: o que a
 * MDO paga por um ciclo depende da CARGA HORÁRIA TOTAL (limitada pela CH da matriz),
 * dividida pelos dias do ciclo, e NÃO da quantidade de anos em si. Duas turmas com a
 * mesma CH total rendem o mesmo por ingressante ao longo do curso, e o curso mais
 * curto o rende mais depressa (cada aluno vale mais por ano e a turma chega à
 * velocidade de cruzeiro antes). Um curso de 4 anos só paga mais se a CH total dele
 * for maior, e isso acaba no teto da CH da matriz.
 */

export interface OpcaoCurso {
  rotulo: string;
  /** Duração da turma, em anos (3 ou 4 no caso do ensino médio integrado). */
  anosDuracao: number;
  /**
   * Duração em meses, para o que dura menos de um ano (uma turma de FIC de 160 h, por exemplo, dura uns 4 meses). Quando
   * informada, vale no lugar de `anosDuracao`.
   */
  mesesDuracao?: number;
  /** Carga horária total prevista para a turma. */
  chTotalCiclo: number;
  /** Teto que a MDO aceita para a matriz (3.000, 3.100 ou 3.200 h no integrado, conforme o eixo). */
  chMatriz: number;
  /** Alunos que ingressam por ano (uma turma por ano). */
  vagasPorAno: number;
  /** Fração de alunos que sai a cada ano (0 a 1). */
  evasaoAnual: number;
}

export interface ParametrosSimulacaoCurso {
  peso: number;
  agropecuaria: boolean;
  /** Valor em reais de uma matrícula equalizada na modalidade do curso. */
  valorMatricula: number;
  /** Primeiro ano civil da simulação; a primeira turma entra nele. */
  anoInicial: number;
  /** Quantos anos simular. */
  horizonteAnos: number;
  /** Mês de início das aulas (1 a 12). Março é o padrão dos institutos. */
  mesInicio?: number;
  /**
   * Se informado, o valor da matrícula cai à medida que o curso novo aumenta a matrícula
   * total da rede (o bolo é fixo; mais matrículas dividem o mesmo dinheiro). Sem isto, o
   * valor da matrícula é tratado como constante, o que é uma boa aproximação para um curso
   * só, mas superestima o ganho de um câmpus que abre muitos.
   */
  diluicao?: { matriculasEquivalentesRede: number };
  /**
   * Reajuste anual do valor da matrícula (0,05 = 5% ao ano), contado a partir de `anoDoValor`. O valor real de cada ano só
   * é conhecido quando a MDO fecha o ciclo, então o padrão é zero (valor constante, a hipótese conservadora).
   */
  reajusteAnual?: number;
  /** Ano a que `valorMatricula` se refere (o ciclo de onde veio). Padrão: `anoInicial`. */
  anoDoValor?: number;
}

export interface LinhaAnoSimulada {
  ano: number;
  turmasAtivas: number;
  alunosAtivos: number;
  matriculaTotal: number;
  /** Valor de uma matrícula naquele ano (com reajuste e diluição, se ligados). */
  valorMatricula: number;
  valor: number;
  valorAcumulado: number;
}

export interface ResultadoOpcaoCurso {
  opcao: OpcaoCurso;
  chEfetiva: number;
  /** CH que ultrapassa o teto da matriz e, portanto, não rende (0 quando não há). */
  chDesperdicada: number;
  linhas: LinhaAnoSimulada[];
  /** Regime: todas as turmas do curso em andamento, ano completo. */
  regime: {
    turmas: number;
    alunosAtivos: number;
    matriculaTotal: number;
    valor: number;
    valorPorAlunoAno: number;
  };
  /** Quanto uma turma inteira rende, do ingresso à formatura, por aluno que ingressou. */
  valorPorIngressante: number;
  valorAcumuladoHorizonte: number;
}

const UM_DIA = 86_400_000;

/** Quantos anos do calendário a turma ocupa (uma turma de 4 meses ocupa 1 ano). */
export function anosOcupados(opcao: OpcaoCurso): number {
  return opcao.mesesDuracao ? Math.max(1, Math.ceil(opcao.mesesDuracao / 12)) : opcao.anosDuracao;
}

/** Último dia de uma turma que começa no dia 1 do mês `mes` de `ano`, `extraMeses` meses depois do fim previsto. */
function fimDaTurma(ano: number, mes: number, opcao: OpcaoCurso, extraMeses = 0): Date {
  const meses = opcao.mesesDuracao ?? opcao.anosDuracao * 12;
  return new Date(Date.UTC(ano, mes - 1 + meses + extraMeses, 1) - UM_DIA);
}

function ciclosDaTurma(
  anoDeInicio: number,
  mesInicio: number,
  opcao: OpcaoCurso,
  p: ParametrosSimulacaoCurso,
): Omit<CicloParaCalculo, "alunos"> {
  const inicio = new Date(Date.UTC(anoDeInicio, mesInicio - 1, 1));
  // Último dia do curso: a véspera do mesmo dia, `anosDuracao` anos depois.
  const termino = fimDaTurma(anoDeInicio, mesInicio, opcao);
  return {
    inicio,
    termino,
    // Prazo de jubilamento: três anos depois do término (não influi enquanto o ciclo está em curso).
    jubilamento: fimDaTurma(anoDeInicio, mesInicio, opcao, 36),
    chCiclo: opcao.chTotalCiclo,
    chMec: 0,
    chMatriz: opcao.chMatriz,
    peso: p.peso,
    agropecuaria: p.agropecuaria,
  };
}

/** Valor da matrícula do ano `ano` (quando informado), com o reajuste e a diluição opcionais. */
export function valorMatriculaNoAno(p: ParametrosSimulacaoCurso, matriculaTotalDoCurso: number, ano?: number): number {
  const anos = ano === undefined ? 0 : ano - (p.anoDoValor ?? p.anoInicial);
  const reajustado = p.valorMatricula * Math.pow(1 + (p.reajusteAnual ?? 0), Math.max(0, anos));
  if (!p.diluicao || p.diluicao.matriculasEquivalentesRede <= 0) return reajustado;
  const m = p.diluicao.matriculasEquivalentesRede;
  return (reajustado * m) / (m + matriculaTotalDoCurso);
}

export function simularOpcaoCurso(opcao: OpcaoCurso, p: ParametrosSimulacaoCurso): ResultadoOpcaoCurso {
  const mes = p.mesInicio ?? 3;
  const chEfetiva = Math.min(opcao.chTotalCiclo, opcao.chMatriz);
  const linhas: LinhaAnoSimulada[] = [];
  let acumulado = 0;

  for (let i = 0; i < p.horizonteAnos; i++) {
    const ano = p.anoInicial + i;
    const periodo = { inicio: new Date(Date.UTC(ano, 0, 1)), fim: new Date(Date.UTC(ano, 11, 31)) };
    let mt = 0;
    let alunos = 0;
    let turmas = 0;
    for (let s = p.anoInicial; s <= ano; s++) {
      const base = ciclosDaTurma(s, mes, opcao, p);
      // Turma já formada antes deste ano: não conta.
      if (base.termino.getTime() < periodo.inicio.getTime()) continue;
      const n = opcao.vagasPorAno * Math.pow(1 - opcao.evasaoAnual, ano - s);
      turmas++;
      alunos += n;
      mt += matriculaTotalDoCiclo({ ...base, alunos: n }, periodo);
    }
    const valorMatricula = valorMatriculaNoAno(p, mt, ano);
    const valor = mt * valorMatricula;
    acumulado += valor;
    linhas.push({ ano, turmasAtivas: turmas, alunosAtivos: alunos, matriculaTotal: mt, valorMatricula, valor, valorAcumulado: acumulado });
  }

  // Regime: um ano "cheio" com as `anosDuracao` turmas em andamento. Cada turma é
  // alinhada ao ano civil (janeiro a dezembro) para que nenhuma tenha ano parcial.
  const anoRegime = 2100;
  const periodoRegime = { inicio: new Date(Date.UTC(anoRegime, 0, 1)), fim: new Date(Date.UTC(anoRegime, 11, 31)) };
  let mtRegime = 0;
  let alunosRegime = 0;
  for (let idade = 0; idade < anosOcupados(opcao); idade++) {
    const n = opcao.vagasPorAno * Math.pow(1 - opcao.evasaoAnual, idade);
    const inicio = new Date(Date.UTC(anoRegime - idade, 0, 1));
    const termino = fimDaTurma(anoRegime - idade, 1, opcao);
    alunosRegime += n;
    mtRegime += matriculaTotalDoCiclo(
      {
        inicio,
        termino,
        jubilamento: new Date(termino.getTime() + 3 * 365 * UM_DIA),
        chCiclo: opcao.chTotalCiclo,
        chMec: 0,
        chMatriz: opcao.chMatriz,
        peso: p.peso,
        agropecuaria: p.agropecuaria,
        alunos: n,
      },
      periodoRegime,
    );
  }
  const valorRegime = mtRegime * valorMatriculaNoAno(p, mtRegime);

  // Uma turma do ingresso à formatura, alinhada ao ano civil, por aluno que ingressou.
  let mtTurma = 0;
  for (let idade = 0; idade < anosOcupados(opcao); idade++) {
    const ano = anoRegime + idade;
    const periodo = { inicio: new Date(Date.UTC(ano, 0, 1)), fim: new Date(Date.UTC(ano, 11, 31)) };
    const inicio = new Date(Date.UTC(anoRegime, 0, 1));
    const termino = fimDaTurma(anoRegime, 1, opcao);
    mtTurma += matriculaTotalDoCiclo(
      {
        inicio,
        termino,
        jubilamento: new Date(termino.getTime() + 3 * 365 * UM_DIA),
        chCiclo: opcao.chTotalCiclo,
        chMec: 0,
        chMatriz: opcao.chMatriz,
        peso: p.peso,
        agropecuaria: p.agropecuaria,
        alunos: Math.pow(1 - opcao.evasaoAnual, idade),
      },
      periodo,
    );
  }

  return {
    opcao,
    chEfetiva,
    chDesperdicada: Math.max(0, opcao.chTotalCiclo - opcao.chMatriz),
    linhas,
    regime: {
      turmas: anosOcupados(opcao),
      alunosAtivos: alunosRegime,
      matriculaTotal: mtRegime,
      valor: valorRegime,
      valorPorAlunoAno: alunosRegime > 0 ? valorRegime / alunosRegime : 0,
    },
    valorPorIngressante: mtTurma * p.valorMatricula,
    valorAcumuladoHorizonte: acumulado,
  };
}

/** Primeiro ano em que o acumulado de A passa o de B (ou null se nunca, no horizonte). */
export function anoDaVirada(a: ResultadoOpcaoCurso, b: ResultadoOpcaoCurso): number | null {
  for (let i = 0; i < a.linhas.length; i++) {
    const la = a.linhas[i]!;
    const lb = b.linhas[i];
    if (lb && la.valorAcumulado > lb.valorAcumulado) return la.ano;
  }
  return null;
}
