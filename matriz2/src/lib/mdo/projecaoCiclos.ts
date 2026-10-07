import { matriculaTotalDoCiclo, diasDoCiclo, icqaDoCiclo, type CicloParaCalculo, type PeriodoPnp, type Repasse } from "./matriculaTotal";
import { ehQualificacaoProfissional, prazoDeJubilamentoEmDias } from "./regrasCiclo";

/**
 * Projeção, ano a ano, do que cada ciclo de curso de uma instituição continua rendendo na matriz enquanto os alunos que já
 * estão matriculados terminam o curso. É a mesma regra da Matrícula Total da MDO (`matriculaTotal.ts`), aplicada a cada
 * "ano-base" futuro da PNP, com os alunos de cada ciclo diminuindo pela evasão até o término e pela retenção depois dele.
 *
 * Duas leituras, sempre separadas:
 *   matriculados  só os alunos que já estão no ciclo hoje, sem nenhuma turma nova: o dinheiro de que o câmpus precisa para
 *                 que todos consigam terminar;
 *   reposição     as turmas novas que entrariam no lugar de cada ciclo regular, uma por ano, com o mesmo tamanho e a mesma duração:
 *                 o regime normal de quem continua ofertando o curso. É uma ESTIMATIVA: o tamanho da turma nova é a matrícula
 *                 de hoje corrigida pela evasão já ocorrida.
 *
 * O ano-base é o ano da PNP em que os alunos são contados; a matriz de dois anos depois usa esse dado (ciclo 2027 = PNP de
 * 2025). O valor em reais usa o valor da matrícula de cada ciclo como está hoje, em preços constantes: a projeção não sabe
 * quanto será o orçamento da rede nem a matrícula dos outros institutos, que também mudam o valor da matrícula.
 *
 * Depois do término do ciclo só uma parte dos alunos continua matriculada (os retidos): a MDO os conta pela metade até o fim do
 * prazo de jubilamento. Essa parte é medida nos próprios ciclos de hoje (`retencaoObservada`), e não suposta.
 *
 * Funções puras: nada aqui lê banco.
 */

const MS_DIA = 86_400_000;
const ANO_EM_DIAS = 365.25;
/** Teto de turmas novas por ciclo na reposição. */
const MAX_TURMAS_NOVAS = 200;
/** A turma nova não é estimada maior do que isto vezes a matrícula de hoje (um ciclo quase no fim, com poucos alunos, não vira turma enorme). */
const MAX_FATOR_ENTRADA = 3;

/** Fração dos alunos do término que ainda estão matriculados 1, 2 e 3 anos depois (retidos). Valor de partida, quando não há como medir. */
export const RETENCAO_PADRAO: readonly number[] = [0.45, 0.17, 0.1];

export interface CicloProjetavel {
  id: number;
  unidadeId: number;
  curso: string;
  tipoCurso: string;
  tipoOferta: string;
  repasse: Repasse;
  inicio: Date;
  termino: Date;
  jubilamento: Date;
  chCiclo: number;
  chMec: number;
  chMatriz: number;
  peso: number;
  agropecuaria: boolean;
  /** Alunos do ciclo no ano-base inicial (a "Qtd. Alunos" da MDO). */
  alunos: number;
  /** Reais por unidade de Matrícula Total deste ciclo (valor do ciclo dividido pela sua Matrícula Total). */
  valorPorMT: number;
}

/** Fração de alunos que sai por ano (0 a 1), na modalidade presencial e na a distância. */
export interface TaxasEvasao {
  presencial: number;
  ead: number;
}

export interface Premissas {
  evasao: TaxasEvasao;
  /** Fração do total do término que continua matriculada 1, 2 e 3 anos depois dele. */
  retencao: readonly number[];
}

export interface PontoProjecao {
  anoBase: number;
  matriculaTotal: number;
  valor: number;
  /** Alunos que a MDO contaria: os do ciclo vezes o ICQA (retido conta metade, jubilado zero). */
  alunosContados: number;
}

export function taxaDoCiclo(ciclo: Pick<CicloProjetavel, "repasse">, taxas: TaxasEvasao): number {
  return ciclo.repasse === "PRESENCIAL" ? taxas.presencial : taxas.ead;
}

export function periodoDoAnoBase(anoBase: number): PeriodoPnp {
  return { inicio: new Date(Date.UTC(anoBase, 0, 1)), fim: new Date(Date.UTC(anoBase, 11, 31)) };
}

/** Fração retida m anos depois do término (m = 0 é o próprio término; além do prazo de 3 anos é zero). */
function retidosEm(retencao: readonly number[], m: number): number {
  if (m <= 0) return 1;
  return retencao[m - 1] ?? 0;
}

/**
 * Quantos alunos o ciclo tem em um ano-base, partindo de `ref` (quantos tinha em `ref.ano`).
 *  - até o ano do término: só a evasão desgasta a turma;
 *  - depois do término: a turma se forma, e sobra a fração retida daquele ano;
 *  - se o ciclo já estava terminado em `ref.ano` (aluno retido), a fração retida segue a curva a partir de onde ele está.
 */
export function alunosNoAno(ref: { alunos: number; ano: number }, termino: Date, ano: number, evasao: number, retencao: readonly number[]): number {
  const T = termino.getUTCFullYear();
  const sobrevivencia = (n: number) => Math.pow(1 - evasao, Math.max(0, n));
  if (ref.ano <= T) {
    if (ano <= T) return ref.alunos * sobrevivencia(ano - ref.ano);
    return ref.alunos * sobrevivencia(T - ref.ano) * retidosEm(retencao, ano - T);
  }
  const m0 = ref.ano - T;
  const r0 = retidosEm(retencao, m0);
  if (r0 > 0) return ref.alunos * (retidosEm(retencao, ano - T) / r0);
  return ref.alunos * sobrevivencia(ano - ref.ano);
}

function paraCalculo(c: CicloProjetavel, alunos: number): CicloParaCalculo {
  return {
    inicio: c.inicio,
    termino: c.termino,
    jubilamento: c.jubilamento,
    chCiclo: c.chCiclo,
    chMec: c.chMec,
    chMatriz: c.chMatriz,
    peso: c.peso,
    agropecuaria: c.agropecuaria,
    alunos,
  };
}

/** Os alunos que já estão no ciclo, ano a ano. O primeiro ano é o valor de hoje. */
export function projetarMatriculados(c: CicloProjetavel, anoBase0: number, anos: number, p: Premissas): PontoProjecao[] {
  const e = taxaDoCiclo(c, p.evasao);
  const pontos: PontoProjecao[] = [];
  for (let k = 0; k < anos; k++) {
    const anoBase = anoBase0 + k;
    const periodo = periodoDoAnoBase(anoBase);
    const alunos = alunosNoAno({ alunos: c.alunos, ano: anoBase0 }, c.termino, anoBase, e, p.retencao);
    const ciclo = paraCalculo(c, alunos);
    const mt = matriculaTotalDoCiclo(ciclo, periodo);
    pontos.push({ anoBase, matriculaTotal: mt, valor: mt * c.valorPorMT, alunosContados: alunos * icqaDoCiclo(ciclo, periodo) });
  }
  return pontos;
}

/** Uma turma que entra no futuro, com o que ela rende em cada ano-base do horizonte. */
export interface TurmaProjetada {
  /** Ano civil em que a turma começa. */
  anoEntrada: number;
  pontos: PontoProjecao[];
}

const pontosVazios = (anoBase0: number, anos: number): PontoProjecao[] =>
  Array.from({ length: anos }, (_, k) => ({ anoBase: anoBase0 + k, matriculaTotal: 0, valor: 0, alunosContados: 0 }));

/** O que uma turma (ciclo) com `alunos` rende em cada ano-base, dado o ano em que entrou. */
function pontosDaTurma(
  turma: CicloProjetavel,
  alunosNaEntrada: number,
  anoDeEntrada: number,
  evasao: number,
  retencao: readonly number[],
  anoBase0: number,
  anos: number,
): PontoProjecao[] {
  const pontos = pontosVazios(anoBase0, anos);
  for (let k = 0; k < anos; k++) {
    const anoBase = anoBase0 + k;
    const periodo = periodoDoAnoBase(anoBase);
    if (turma.inicio.getTime() > periodo.fim.getTime()) continue;
    const alunos = alunosNoAno({ alunos: alunosNaEntrada, ano: anoDeEntrada }, turma.termino, anoBase, evasao, retencao);
    const ciclo = paraCalculo(turma, alunos);
    const mt = matriculaTotalDoCiclo(ciclo, periodo);
    pontos[k]!.matriculaTotal += mt;
    pontos[k]!.valor += mt * turma.valorPorMT;
    pontos[k]!.alunosContados += alunos * icqaDoCiclo(ciclo, periodo);
  }
  return pontos;
}

const somarPontos = (turmas: TurmaProjetada[], anoBase0: number, anos: number, ate?: number): PontoProjecao[] => {
  const soma = pontosVazios(anoBase0, anos);
  for (const t of turmas) {
    if (ate !== undefined && t.anoEntrada > ate) continue;
    t.pontos.forEach((p, k) => {
      soma[k]!.matriculaTotal += p.matriculaTotal;
      soma[k]!.valor += p.valor;
      soma[k]!.alunosContados += p.alunosContados;
    });
  }
  return soma;
};

/**
 * As turmas novas que entram no lugar do ciclo regular, uma por ano de intervalo (ou a cada duração do ciclo, se for maior que um
 * ano), cada uma com a duração do ciclo e o tamanho estimado da matrícula de entrada. Ciclo já terminado (aluno retido) não tem
 * reposição: é a sobra de uma turma antiga. Devolvidas turma a turma, para a tela poder parar de repor a partir de um ano
 * (curso que deixa de ser ofertado) sem refazer a conta.
 */
export function turmasDeReposicao(c: CicloProjetavel, anoBase0: number, anos: number, p: Premissas): TurmaProjetada[] {
  const periodo0 = periodoDoAnoBase(anoBase0);
  if (c.alunos <= 0 || c.termino.getTime() < periodo0.inicio.getTime()) return [];

  const e = taxaDoCiclo(c, p.evasao);
  const duracao = diasDoCiclo(c);
  if (duracao < 1) return [];

  // A turma nova entra quando a anterior acaba, mas nunca com menos de um ano de intervalo: um ciclo curto (um curso FIC de 20 dias)
  // é ofertado uma vez por ano, e não repetido um atrás do outro, o que multiplicaria o valor por dezenas.
  const intervalo = Math.max(duracao, 365) * MS_DIA;
  let inicio = c.inicio.getTime() + intervalo;
  // Se a turma seguinte já cabia no ano-base inicial, ela está entre os ciclos de hoje e é ela quem gera as próximas: contar de novo duplicaria.
  if (inicio <= periodo0.fim.getTime()) return [];

  // Tamanho da turma de entrada: a matrícula de hoje desfeita da evasão que já ocorreu desde o início do ciclo.
  const meioDoAnoBase0 = Date.UTC(anoBase0, 5, 30);
  const anosDecorridos = Math.min(Math.max(0, (meioDoAnoBase0 - c.inicio.getTime()) / (ANO_EM_DIAS * MS_DIA)), duracao / ANO_EM_DIAS);
  const fatorEntrada = Math.min(MAX_FATOR_ENTRADA, 1 / Math.pow(1 - e, anosDecorridos));
  const entrada = c.alunos * fatorEntrada;

  const fimDoHorizonte = periodoDoAnoBase(anoBase0 + anos - 1).fim.getTime();
  const prazo = prazoDeJubilamentoEmDias(c.tipoCurso);
  const turmas: TurmaProjetada[] = [];
  for (let n = 0; n < MAX_TURMAS_NOVAS && inicio <= fimDoHorizonte; n++) {
    const termino = inicio + (duracao - 1) * MS_DIA;
    const turma: CicloProjetavel = { ...c, inicio: new Date(inicio), termino: new Date(termino), jubilamento: new Date(termino + prazo * MS_DIA) };
    const anoDeEntrada = new Date(inicio).getUTCFullYear();
    turmas.push({ anoEntrada: anoDeEntrada, pontos: pontosDaTurma(turma, entrada, anoDeEntrada, e, p.retencao, anoBase0, anos) });
    inicio += intervalo;
  }
  return turmas;
}

/**
 * A soma da reposição. `ultimoAnoDeEntrada` é o último ano em que ainda entra turma nova (curso que deixa de ser ofertado depois dele);
 * sem ele, o curso continua sendo ofertado em todo o horizonte. As turmas que já entraram terminam o curso normalmente.
 */
export function projetarReposicao(c: CicloProjetavel, anoBase0: number, anos: number, p: Premissas, ultimoAnoDeEntrada?: number): PontoProjecao[] {
  return somarPontos(turmasDeReposicao(c, anoBase0, anos, p), anoBase0, anos, ultimoAnoDeEntrada);
}

export { somarPontos as somarTurmas };

/** Um curso novo que o cenário abre: onde, quando, com quantos alunos por turma e por quantos anos seguidos entra turma. */
export interface CursoNovo {
  tipoCurso: string;
  repasse: Repasse;
  peso: number;
  /** Carga horária que vale na matriz. */
  chMatriz: number;
  /** Reais por unidade de Matrícula Total (valor da matrícula na modalidade). */
  valorPorMT: number;
  /** Ano civil da primeira turma. */
  primeiroAnoEntrada: number;
  /** Ano civil da última turma; igual ao primeiro quando é uma turma só. */
  ultimoAnoEntrada: number;
  /** Mês em que a primeira turma de cada ano começa (1 a 12). */
  mesInicio: number;
  /** Quantas turmas entram por ano: 1 (curso anual) ou 2 (semestral, a segunda seis meses depois da primeira). Padrão 1. */
  entradasPorAno?: 1 | 2;
  ingressantes: number;
  duracaoAnos: number;
}

/** As turmas de um curso novo: uma por ano, do primeiro ao último ano de entrada. */
export function turmasDeCursoNovo(curso: CursoNovo, anoBase0: number, anos: number, p: Premissas): TurmaProjetada[] {
  const duracaoDias = Math.max(1, Math.round(curso.duracaoAnos * ANO_EM_DIAS));
  const prazo = prazoDeJubilamentoEmDias(curso.tipoCurso);
  const e = taxaDoCiclo(curso, p.evasao);
  const turmas: TurmaProjetada[] = [];
  const ultimo = Math.min(curso.ultimoAnoEntrada, anoBase0 + anos - 1);
  // Uma turma por ano (curso anual) ou duas (semestral): as entradas andam de 12 em 12 meses, ou de 6 em 6, a partir do mês da primeira.
  const mesesEntreEntradas = curso.entradasPorAno === 2 ? 6 : 12;
  const mesDaPrimeira = Math.min(12, Math.max(1, curso.mesInicio)) - 1;
  for (let n = 0; n < 400; n++) {
    const inicio = Date.UTC(curso.primeiroAnoEntrada, mesDaPrimeira + n * mesesEntreEntradas, 1);
    const ano = new Date(inicio).getUTCFullYear();
    if (ano > ultimo) break;
    if (ano < anoBase0) continue;
    const termino = inicio + (duracaoDias - 1) * MS_DIA;
    const turma: CicloProjetavel = {
      id: -1,
      unidadeId: -1,
      curso: "",
      tipoCurso: curso.tipoCurso,
      tipoOferta: "",
      repasse: curso.repasse,
      inicio: new Date(inicio),
      termino: new Date(termino),
      jubilamento: new Date(termino + prazo * MS_DIA),
      chCiclo: curso.chMatriz,
      chMec: curso.chMatriz,
      chMatriz: curso.chMatriz,
      peso: curso.peso,
      agropecuaria: false,
      alunos: curso.ingressantes,
      valorPorMT: curso.valorPorMT,
    };
    turmas.push({ anoEntrada: ano, pontos: pontosDaTurma(turma, curso.ingressantes, ano, e, p.retencao, anoBase0, anos) });
  }
  return turmas;
}

export function projetarCursoNovo(curso: CursoNovo, anoBase0: number, anos: number, p: Premissas): PontoProjecao[] {
  return somarPontos(turmasDeCursoNovo(curso, anoBase0, anos, p), anoBase0, anos);
}

/**
 * O último ano civil em que um ciclo que NÃO se repete termina: os ciclos regulares de hoje (que acabam e, se o curso para de ser ofertado,
 * não são repostos) e as turmas dos cursos novos. Serve para sugerir o horizonte "até o último ciclo terminar".
 */
export function ultimoAnoDeTermino(ciclos: Array<Pick<CicloProjetavel, "termino" | "alunos">>, novos: CursoNovo[], anoBase0: number): number {
  const inicioBase = Date.UTC(anoBase0, 0, 1);
  let ultimo = anoBase0;
  for (const c of ciclos) if (c.alunos > 0 && c.termino.getTime() >= inicioBase) ultimo = Math.max(ultimo, c.termino.getUTCFullYear());
  for (const n of novos) {
    const dias = Math.max(1, Math.round(n.duracaoAnos * ANO_EM_DIAS));
    // A última turma é a segunda do ano, seis meses depois, num curso semestral.
    const mesDaUltima = Math.min(12, Math.max(1, n.mesInicio)) - 1 + (n.entradasPorAno === 2 ? 6 : 0);
    const termino = Date.UTC(n.ultimoAnoEntrada, mesDaUltima, 1) + (dias - 1) * MS_DIA;
    ultimo = Math.max(ultimo, new Date(termino).getUTCFullYear());
  }
  return ultimo;
}

/**
 * A curva de retenção observada nos ciclos de hoje: dos alunos que estavam em ciclos que terminam no ano-base, quantos aparecem
 * em ciclos que terminaram 1, 2 e 3 anos antes (e portanto ainda estão matriculados, retidos). É uma comparação de turmas de anos
 * diferentes, que supõe turmas de tamanho parecido; com poucos alunos no término, devolve a curva padrão. Qualificação
 * profissional (FIC) fica de fora: ela não tem prazo de jubilamento.
 */
export function retencaoObservada(
  ciclos: Array<Pick<CicloProjetavel, "termino" | "alunos" | "tipoCurso">>,
  anoBase0: number,
): { retencao: number[]; observada: boolean; alunosNoTermino: number } {
  const alunosPorAno = new Map<number, number>();
  for (const c of ciclos) {
    if (ehQualificacaoProfissional(c.tipoCurso)) continue;
    const t = c.termino.getUTCFullYear();
    alunosPorAno.set(t, (alunosPorAno.get(t) ?? 0) + c.alunos);
  }
  const noTermino = alunosPorAno.get(anoBase0) ?? 0;
  if (noTermino < 50) return { retencao: [...RETENCAO_PADRAO], observada: false, alunosNoTermino: noTermino };
  const retencao: number[] = [];
  let anterior = 1;
  for (let m = 1; m <= 3; m++) {
    const r = Math.min(anterior, (alunosPorAno.get(anoBase0 - m) ?? 0) / noTermino);
    retencao.push(r);
    anterior = r;
  }
  return { retencao, observada: true, alunosNoTermino: noTermino };
}

export interface SituacaoDoCiclo {
  /** Ano civil do término previsto. */
  anoTermino: number;
  /** O ciclo ainda é regular no ano-base inicial (termina nele ou depois), em vez de ser uma turma já atrasada. */
  regular: boolean;
  /** Último ano-base em que o ciclo ainda conta alguma coisa na matriz (até o fim do prazo de jubilamento). */
  ultimoAnoComValor: number;
}

export function situacaoDoCiclo(c: Pick<CicloProjetavel, "termino" | "jubilamento">, anoBase0: number): SituacaoDoCiclo {
  const periodo0 = periodoDoAnoBase(anoBase0);
  return {
    anoTermino: c.termino.getUTCFullYear(),
    regular: c.termino.getTime() >= periodo0.inicio.getTime(),
    ultimoAnoComValor: c.jubilamento.getUTCFullYear(),
  };
}

export interface ResumoAno {
  anoBase: number;
  /** Ano do ciclo orçamentário que usa este ano-base (dois anos depois). */
  anoCiclo: number;
  matriculaTotal: number;
  valor: number;
  valorReposicao: number;
  alunosContados: number;
}

/** Soma um conjunto de ciclos, ano a ano, nas duas leituras. */
export function somarProjecao(ciclos: CicloProjetavel[], anoBase0: number, anos: number, p: Premissas, defasagemDaMatriz = 2): ResumoAno[] {
  const resumo: ResumoAno[] = Array.from({ length: anos }, (_, k) => ({
    anoBase: anoBase0 + k,
    anoCiclo: anoBase0 + k + defasagemDaMatriz,
    matriculaTotal: 0,
    valor: 0,
    valorReposicao: 0,
    alunosContados: 0,
  }));
  for (const c of ciclos) {
    const base = projetarMatriculados(c, anoBase0, anos, p);
    const novos = projetarReposicao(c, anoBase0, anos, p);
    for (let k = 0; k < anos; k++) {
      resumo[k]!.matriculaTotal += base[k]!.matriculaTotal;
      resumo[k]!.valor += base[k]!.valor;
      resumo[k]!.alunosContados += base[k]!.alunosContados;
      resumo[k]!.valorReposicao += novos[k]!.valor;
    }
  }
  return resumo;
}
