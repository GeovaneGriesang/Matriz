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

/**
 * As turmas novas que entram no lugar do ciclo regular, uma por ano de intervalo (ou a cada duração do ciclo, se for maior que um
 * ano), cada uma com a duração do ciclo e o tamanho estimado da matrícula de entrada. Ciclo já terminado (aluno retido) não tem
 * reposição: é a sobra de uma turma antiga.
 */
export function projetarReposicao(c: CicloProjetavel, anoBase0: number, anos: number, p: Premissas): PontoProjecao[] {
  const pontos: PontoProjecao[] = Array.from({ length: anos }, (_, k) => ({ anoBase: anoBase0 + k, matriculaTotal: 0, valor: 0, alunosContados: 0 }));
  const periodo0 = periodoDoAnoBase(anoBase0);
  if (c.alunos <= 0 || c.termino.getTime() < periodo0.inicio.getTime()) return pontos;

  const e = taxaDoCiclo(c, p.evasao);
  const duracao = diasDoCiclo(c);
  if (duracao < 1) return pontos;

  // A turma nova entra quando a anterior acaba, mas nunca com menos de um ano de intervalo: um ciclo curto (um curso FIC de 20 dias)
  // é ofertado uma vez por ano, e não repetido um atrás do outro, o que multiplicaria o valor por dezenas.
  const intervalo = Math.max(duracao, 365) * MS_DIA;
  let inicio = c.inicio.getTime() + intervalo;
  // Se a turma seguinte já cabia no ano-base inicial, ela está entre os ciclos de hoje e é ela quem gera as próximas: contar de novo duplicaria.
  if (inicio <= periodo0.fim.getTime()) return pontos;

  // Tamanho da turma de entrada: a matrícula de hoje desfeita da evasão que já ocorreu desde o início do ciclo.
  const meioDoAnoBase0 = Date.UTC(anoBase0, 5, 30);
  const anosDecorridos = Math.min(Math.max(0, (meioDoAnoBase0 - c.inicio.getTime()) / (ANO_EM_DIAS * MS_DIA)), duracao / ANO_EM_DIAS);
  const fatorEntrada = Math.min(MAX_FATOR_ENTRADA, 1 / Math.pow(1 - e, anosDecorridos));
  const entrada = c.alunos * fatorEntrada;

  const fimDoHorizonte = periodoDoAnoBase(anoBase0 + anos - 1).fim.getTime();
  const prazo = prazoDeJubilamentoEmDias(c.tipoCurso);
  for (let n = 0; n < MAX_TURMAS_NOVAS && inicio <= fimDoHorizonte; n++) {
    const termino = inicio + (duracao - 1) * MS_DIA;
    const turma: CicloProjetavel = { ...c, inicio: new Date(inicio), termino: new Date(termino), jubilamento: new Date(termino + prazo * MS_DIA) };
    const anoDeEntrada = new Date(inicio).getUTCFullYear();
    for (let k = 0; k < anos; k++) {
      const anoBase = anoBase0 + k;
      const periodo = periodoDoAnoBase(anoBase);
      if (inicio > periodo.fim.getTime()) continue;
      const alunos = alunosNoAno({ alunos: entrada, ano: anoDeEntrada }, turma.termino, anoBase, e, p.retencao);
      const ciclo = paraCalculo(turma, alunos);
      const mt = matriculaTotalDoCiclo(ciclo, periodo);
      pontos[k]!.matriculaTotal += mt;
      pontos[k]!.valor += mt * c.valorPorMT;
      pontos[k]!.alunosContados += alunos * icqaDoCiclo(ciclo, periodo);
    }
    inicio += intervalo;
  }
  return pontos;
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
