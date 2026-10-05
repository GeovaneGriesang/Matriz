/**
 * Motor da Matrícula Total de um ciclo de curso, o número que a MDO multiplica pelo
 * valor de uma matrícula para chegar ao que o ciclo recebe.
 *
 * Origem: a 6ª fase de 2027 do IFSul (exportada em 2026-09-29) chegou como planilha
 * COM FÓRMULAS e sem valores gravados, e a "Matrícula Total" de cada linha é o
 * resultado da regra abaixo. Ela foi decifrada contra as 1.352 linhas calculadas pelo
 * Excel: 1.349 batem exatamente, e as 3 restantes eram ciclos com carga horária do
 * ciclo abaixo do mínimo do MEC (cobertas pela regra da CH efetiva, mais abaixo).
 *
 *   MT = alunos × ICQA × peso × bônus agropecuária × (CH efetiva / 800)
 *        × dias ativos no período ÷ dias do ciclo
 *
 * Lida assim: cada aluno rende, por dia, uma fração da carga horária do curso; o
 * ciclo só conta os dias que caem dentro do período da PNP (o ano-base); o peso
 * reflete o custo do curso (laboratórios, Portaria MEC 243/2026, que revogou a 646/2022 mantendo o critério); 800 horas por ano é
 * a referência de "um aluno cheio".
 *
 * Nada aqui toca banco nem tela: é o mesmo cálculo usado na carga (para preencher o
 * que a planilha deixou em fórmula), no simulador de curso e no "quanto vale um
 * aluno", e por isso é testado contra os números do Excel.
 */

/** Carga horária anual de referência: um aluno que cursa 800 h/ano vale "1,0". */
export const CH_REFERENCIA_ANUAL = 800;
/** Bônus de matrícula dos cursos de agropecuária (a fazenda-escola tem custo próprio). */
export const BONUS_AGROPECUARIA = 1.5;
/** Retido dentro do prazo de jubilamento conta meio ano, e com ICQA 0,5 (ver `icqaDoCiclo`). */
export const DIAS_ATIVOS_RETIDO = 182.5;

export type Repasse = "PRESENCIAL" | "EAD" | "EAD_MOOC" | "EAD_FP";

export interface PeriodoPnp {
  /** Primeiro dia do ano-base da PNP (ex.: 2025-01-01 para o ciclo 2027). */
  inicio: Date;
  /** Último dia do ano-base (ex.: 2025-12-31). */
  fim: Date;
}

export interface CicloParaCalculo {
  inicio: Date;
  termino: Date;
  jubilamento: Date;
  /** Carga horária do ciclo (CHC). */
  chCiclo: number;
  /** Carga horária mínima do catálogo do MEC (CHMC). */
  chMec: number;
  /** Carga horária que vale para a matriz (CHM). */
  chMatriz: number;
  peso: number;
  agropecuaria: boolean;
  /** Alunos matriculados no ciclo (Qtd. Alunos). */
  alunos: number;
}

const MS_DIA = 86_400_000;

/** Dias inteiros entre duas datas, contando as duas pontas (como o Excel: fim - início + 1). */
export function diasInclusivos(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / MS_DIA) + 1;
}

/** Duração do ciclo em dias, contando início e término. */
export function diasDoCiclo(ciclo: Pick<CicloParaCalculo, "inicio" | "termino">): number {
  return diasInclusivos(ciclo.inicio, ciclo.termino);
}

/**
 * ICQA, a fração dos alunos que a MDO conta para a matriz:
 *   0    jubilamento anterior ao início do período (aluno retido há tempo demais);
 *   1    ciclo cujo término é do período em diante (aluno regular);
 *   0,5  o ciclo já devia ter terminado antes do período, mas o aluno ainda está
 *        dentro do prazo de jubilamento (retido).
 */
export function icqaDoCiclo(
  ciclo: Pick<CicloParaCalculo, "termino" | "jubilamento">,
  periodo: PeriodoPnp,
): 0 | 0.5 | 1 {
  if (ciclo.jubilamento.getTime() < periodo.inicio.getTime()) return 0;
  if (ciclo.termino.getTime() >= periodo.inicio.getTime()) return 1;
  return 0.5;
}

/**
 * Dias do ciclo que contam dentro do período da PNP. Ciclo regular: a interseção
 * entre o ciclo e o período. Retido: fixo em 182,5 (meio ano), não importa quando o
 * ciclo devia ter acabado. Jubilado: zero (e o ICQA já zera de todo modo).
 */
export function diasAtivosNoPeriodo(
  ciclo: Pick<CicloParaCalculo, "inicio" | "termino" | "jubilamento">,
  periodo: PeriodoPnp,
): number {
  if (ciclo.termino.getTime() >= periodo.inicio.getTime()) {
    const de = Math.max(ciclo.inicio.getTime(), periodo.inicio.getTime());
    const ate = Math.min(ciclo.termino.getTime(), periodo.fim.getTime());
    return Math.max(0, Math.round((ate - de) / MS_DIA) + 1);
  }
  if (ciclo.jubilamento.getTime() >= periodo.inicio.getTime()) return DIAS_ATIVOS_RETIDO;
  return 0;
}

/**
 * Carga horária que efetivamente entra na conta.
 *
 * Ciclo de até um ano: vale a CH da matriz, inteira, e o que limita o quanto ele rende é
 * a fração de dias que cai no período. Ciclo de mais de um ano: vale a menor entre a CH
 * do ciclo e a CH da matriz (a da matriz limita o quanto uma instituição pode "inflar"
 * um curso). Foi a quebra em 365 dias que faltava para fechar as 3 últimas das 1.352
 * linhas da 6ª fase de 2027 do IFSul (ciclos curtos cuja CH do ciclo, 1.520 h e 2.205 h,
 * estava abaixo do mínimo do MEC e da matriz).
 */
export function chEfetiva(
  ciclo: Pick<CicloParaCalculo, "inicio" | "termino" | "chCiclo" | "chMatriz">,
): number {
  if (diasDoCiclo(ciclo) <= 365) return ciclo.chMatriz;
  return Math.min(ciclo.chCiclo, ciclo.chMatriz);
}

export interface DecomposicaoMatricula {
  alunos: number;
  icqa: number;
  peso: number;
  bonusAgropecuaria: number;
  chEfetiva: number;
  /** chEfetiva / 800. */
  fatorCargaHoraria: number;
  diasAtivos: number;
  diasDoCiclo: number;
  /** diasAtivos / diasDoCiclo. */
  fatorDias: number;
  matriculaTotal: number;
}

/** A conta inteira, passo a passo, para a tela poder mostrar de onde o número vem. */
export function decomporMatriculaTotal(ciclo: CicloParaCalculo, periodo: PeriodoPnp): DecomposicaoMatricula {
  const icqa = icqaDoCiclo(ciclo, periodo);
  const dias = diasDoCiclo(ciclo);
  const ativos = diasAtivosNoPeriodo(ciclo, periodo);
  const ch = chEfetiva(ciclo);
  const bonus = ciclo.agropecuaria ? BONUS_AGROPECUARIA : 1;
  const fatorCh = ch / CH_REFERENCIA_ANUAL;
  const fatorDias = dias > 0 ? ativos / dias : 0;
  return {
    alunos: ciclo.alunos,
    icqa,
    peso: ciclo.peso,
    bonusAgropecuaria: bonus,
    chEfetiva: ch,
    fatorCargaHoraria: fatorCh,
    diasAtivos: ativos,
    diasDoCiclo: dias,
    fatorDias,
    matriculaTotal: ciclo.alunos * icqa * ciclo.peso * bonus * fatorCh * fatorDias,
  };
}

export function matriculaTotalDoCiclo(ciclo: CicloParaCalculo, periodo: PeriodoPnp): number {
  return decomporMatriculaTotal(ciclo, periodo).matriculaTotal;
}

// ---------------------------------------------------------------------------
// Valor de uma matrícula, a partir dos parâmetros do ciclo orçamentário.
// ---------------------------------------------------------------------------

/** Pesos oficiais da modalidade de repasse (sobre o presencial, que vale 1). */
export const PESO_REPASSE_PADRAO: Record<Repasse, number> = {
  PRESENCIAL: 1,
  EAD: 0.25,
  EAD_MOOC: 0.08,
  EAD_FP: 0.8,
};

export interface ParametrosValorMatricula {
  valorOrcamento: number;
  ajuste: number;
  assistenciaEstudantil: number;
  /** Reserva do Piso Mínimo dos câmpus novos, retirada de dentro dos 80%. */
  novosCampi: number;
  /** Fração do orçamento destinada ao Funcionamento (0,8). */
  percentualFuncionamento: number;
  /** Matrícula Total da REDE inteira por modalidade, já ponderada pelo peso do curso. */
  matriculasTotaisRede: Record<Repasse, number>;
  pesos: Record<Repasse, number>;
}

/** Quanto sobra para ratear por matrícula: (SPO - assistência - ajuste) × 80% - piso. */
export function fundoParaMatriculas(p: ParametrosValorMatricula): number {
  return (p.valorOrcamento - p.assistenciaEstudantil - p.ajuste) * p.percentualFuncionamento - p.novosCampi;
}

/** Soma das matrículas da rede convertidas para "presencial equivalente". */
export function matriculasEquivalentesRede(p: ParametrosValorMatricula): number {
  return (Object.keys(p.matriculasTotaisRede) as Repasse[]).reduce(
    (soma, r) => soma + p.matriculasTotaisRede[r] * p.pesos[r],
    0,
  );
}

/** Valor em reais de UMA matrícula equalizada, em cada modalidade de repasse. */
export function valorPorMatricula(p: ParametrosValorMatricula): Record<Repasse, number> {
  const base = fundoParaMatriculas(p) / matriculasEquivalentesRede(p);
  return {
    PRESENCIAL: base * p.pesos.PRESENCIAL,
    EAD: base * p.pesos.EAD,
    EAD_MOOC: base * p.pesos.EAD_MOOC,
    EAD_FP: base * p.pesos.EAD_FP,
  };
}

/**
 * Valor de um ciclo, e quanto ele "perde" por aluno não contado (evasão/retenção).
 * As colunas auxiliares seguem a planilha de 2027 uma a uma: são elas que dão o
 * "Custo Evadido" quando o ICQA é zero (o ciclo inteiro fica de fora e a planilha
 * estima quanto valeria se contasse).
 */
export function valorDoCiclo(
  ciclo: CicloParaCalculo,
  matriculaTotal: number,
  valorMatricula: number,
  periodo: PeriodoPnp,
): { valor: number; custoEvadido: number; alunosContabilizados: number; alunosNaoContabilizados: number } {
  const icqa = icqaDoCiclo(ciclo, periodo);
  const contabilizados = ciclo.alunos * icqa;
  const naoContabilizados = ciclo.alunos - contabilizados;
  const valor = valorMatricula * matriculaTotal;

  let custoEvadido: number;
  if (icqa === 0) {
    const dias = diasDoCiclo(ciclo);
    const chPorDia = Math.min(ciclo.chMatriz, ciclo.chMec) / dias;
    const chAno = dias > 365 ? chPorDia * 365 : ciclo.chMatriz;
    const fech = dias > 365 ? chAno / CH_REFERENCIA_ANUAL : ciclo.chMatriz / CH_REFERENCIA_ANUAL;
    const inicioDoAno = Date.UTC(ciclo.termino.getUTCFullYear(), 0, 1);
    const feda = (Math.round((ciclo.termino.getTime() - inicioDoAno) / MS_DIA) + 1) / 365;
    const mechda = naoContabilizados * fech * feda;
    const bonus = ciclo.agropecuaria ? BONUS_AGROPECUARIA : 1;
    custoEvadido = ciclo.peso * mechda * bonus * valorMatricula;
  } else {
    custoEvadido = ciclo.alunos > 0 ? (valor / ciclo.alunos) * naoContabilizados : 0;
  }
  return { valor, custoEvadido, alunosContabilizados: contabilizados, alunosNaoContabilizados: naoContabilizados };
}
