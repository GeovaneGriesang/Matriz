import { CH_REFERENCIA_ANUAL, PESO_REPASSE_PADRAO, type Repasse } from "./matriculaTotal";
import { chMatrizPorRegra } from "./regrasCiclo";

/**
 * O que a MDO paga por UM aluno de um curso, a partir do peso e da carga horária do curso.
 *
 * Pela regra da Matrícula Total, cada aluno rende, por dia de curso, uma fração da carga horária; somando o curso inteiro, os dias se compensam
 * e o aluno que faz o curso do início ao fim rende, no total:
 *
 *   matrículas equivalentes por aluno = peso do curso x (carga horária que vale na matriz / 800)
 *   valor por aluno no curso inteiro  = matrículas equivalentes x valor de uma matrícula
 *
 * Dividido pelos anos de duração, dá o valor por ano. Não depende de quantos anos o curso dura, só da carga horária total (limitada pela carga
 * horária da matriz): por isso um curso de 3 anos e um de 4 com a mesma carga horária rendem o mesmo por aluno, e o mais curto rende mais depressa.
 *
 * É o valor de referência de um aluno que não evade. Ele muda a cada ciclo orçamentário (o valor da matrícula depende do orçamento e das
 * matrículas da rede) e não inclui o bônus de agropecuária, que já está dentro do peso efetivo.
 */

export interface EntradaValorDoCurso {
  tipoCurso: string;
  tipoOferta: string;
  /** Carga horária mínima do MEC para o curso. */
  chMinimaMec: number;
  /** Peso efetivo do curso (já com o bônus de agropecuária, se houver). */
  pesoEfetivo: number;
  /** Valor em reais de uma matrícula equalizada presencial no ciclo. */
  valorMatriculaPresencial: number;
  /** Modalidade de repasse: a distância vale uma fração do presencial. */
  repasse?: Repasse;
  /** Duração do curso em anos, se a pessoa informar. */
  anosDeCurso?: number;
}

export interface ValorDoCurso {
  chMatriz: number;
  fatorCargaHoraria: number;
  matriculasEquivalentesPorAluno: number;
  valorDaMatricula: number;
  valorPorAlunoNoCurso: number;
  valorPorAlunoPorAno: number | null;
}

/**
 * A carga horária que vale na matriz. Para qualificação profissional (FIC) e doutorado a regra é a carga horária do próprio ciclo; sem ela,
 * usa-se a mínima do MEC como aproximação.
 */
export function chDaMatrizDoCurso(tipoCurso: string, tipoOferta: string, chMinimaMec: number): number {
  return chMatrizPorRegra(tipoCurso, tipoOferta, chMinimaMec, chMinimaMec);
}

export function valorDoCurso(e: EntradaValorDoCurso): ValorDoCurso {
  const chMatriz = chDaMatrizDoCurso(e.tipoCurso, e.tipoOferta, e.chMinimaMec);
  const fator = chMatriz / CH_REFERENCIA_ANUAL;
  const equivalentes = e.pesoEfetivo * fator;
  const valorDaMatricula = e.valorMatriculaPresencial * PESO_REPASSE_PADRAO[e.repasse ?? "PRESENCIAL"];
  const valorPorAlunoNoCurso = equivalentes * valorDaMatricula;
  return {
    chMatriz,
    fatorCargaHoraria: fator,
    matriculasEquivalentesPorAluno: equivalentes,
    valorDaMatricula,
    valorPorAlunoNoCurso,
    valorPorAlunoPorAno: e.anosDeCurso && e.anosDeCurso > 0 ? valorPorAlunoNoCurso / e.anosDeCurso : null,
  };
}
