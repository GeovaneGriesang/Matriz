import {
  CH_REFERENCIA_ANUAL,
  decomporMatriculaTotal,
  diasDoCiclo,
  type DecomposicaoMatricula,
  type PeriodoPnp,
} from "./matriculaTotal";

/**
 * Quanto vale UM aluno de um ciclo no orçamento de um câmpus, e por quê.
 *
 * Parte de um ciclo já carregado (o que a MDO publicou) e reabre a conta com o motor da
 * Matrícula Total, para a tela poder mostrar cada fator que multiplica o valor do aluno.
 * Duas medidas, porque respondem perguntas diferentes:
 *
 *   efetivo     o que o aluno rendeu NESTE ciclo orçamentário: valor do ciclo ÷ alunos.
 *               Inclui o efeito de o ciclo ter começado ou terminado no meio do ano-base.
 *   ano cheio   o que um aluno rende por ano quando cursa o ano inteiro: é o valor
 *               "de regime", comparável entre cursos e entre turmas.
 */

export interface CicloArmazenado {
  inicio: Date | null;
  termino: Date | null;
  jubilamento: Date | null;
  chMinimaMec: number | null;
  cargaHoraria: number | null;
  chMatriz: number | null;
  peso: number | null;
  alunos: number | null;
  matriculaTotal: number;
  valorReais: number;
  /** Valor em reais de uma matrícula equalizada na modalidade do ciclo. */
  valorMatricula: number | null;
  /** `null` na exportação antiga da rede, que não trazia a coluna. */
  agropecuaria: boolean | null;
}

export interface AnaliseAluno {
  decomposicao: DecomposicaoMatricula;
  agropecuariaInferida: boolean;
  valorEfetivoPorAluno: number;
  valorAnoCheioPorAluno: number;
  /** A Matrícula Total refeita pelo motor difere da publicada (em valor absoluto). */
  divergenciaMotor: number;
}

export function periodoDoCiclo(ano: number): PeriodoPnp {
  // O ciclo orçamentário N usa a PNP de N-2 (2027 usa 2025).
  return { inicio: new Date(Date.UTC(ano - 2, 0, 1)), fim: new Date(Date.UTC(ano - 2, 11, 31)) };
}

/** `null` quando faltam datas ou aluno para refazer a conta. */
export function analisarCiclo(c: CicloArmazenado, periodo: PeriodoPnp): AnaliseAluno | null {
  if (!c.inicio || !c.termino || !c.jubilamento || !c.alunos || c.alunos <= 0) return null;
  const entrada = {
    inicio: c.inicio,
    termino: c.termino,
    jubilamento: c.jubilamento,
    chCiclo: c.cargaHoraria ?? 0,
    chMec: c.chMinimaMec ?? 0,
    chMatriz: c.chMatriz ?? 0,
    peso: c.peso ?? 1,
    alunos: c.alunos,
  };
  // A exportação antiga não diz se o curso é de agropecuária; deduz-se de qual das duas
  // hipóteses (com ou sem os 50%) chega mais perto da Matrícula Total publicada.
  let agro = c.agropecuaria;
  let inferida = false;
  if (agro === null) {
    const sem = decomporMatriculaTotal({ ...entrada, agropecuaria: false }, periodo).matriculaTotal;
    agro = sem > 0 && Math.abs(c.matriculaTotal - sem * 1.5) < Math.abs(c.matriculaTotal - sem);
    inferida = agro;
  }
  const d = decomporMatriculaTotal({ ...entrada, agropecuaria: agro }, periodo);

  const valorMatricula = c.valorMatricula ?? (c.matriculaTotal > 0 ? c.valorReais / c.matriculaTotal : 0);
  const dias = diasDoCiclo(entrada);
  const fatorAno = dias > 365 ? 365 / dias : 1;
  const anoCheio = valorMatricula * d.peso * d.bonusAgropecuaria * ((d.chEfetiva / CH_REFERENCIA_ANUAL) * fatorAno);

  return {
    decomposicao: d,
    agropecuariaInferida: inferida,
    valorEfetivoPorAluno: c.valorReais / c.alunos,
    valorAnoCheioPorAluno: anoCheio,
    divergenciaMotor: Math.abs(d.matriculaTotal - c.matriculaTotal),
  };
}
