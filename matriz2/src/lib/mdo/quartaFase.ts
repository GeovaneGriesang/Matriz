/**
 * A planilha da 4ª fase da MDO ("Checagem de Matrículas Totais", aba "Ciclos de Matrículas", versão 8.5), refeita coluna a
 * coluna com as fórmulas do próprio Excel.
 *
 * Por que existe, além do motor (`matriculaTotal.ts`): a DDI confere a Matrícula Total nessa planilha, e a conferência
 * precisa enxergar as MESMAS colunas (CHM, QDTC, CHMD, CHA, FECH, DACP 1 a 5, FEDA, FECHDA, MECHDA, MP, BA, MT). O motor
 * faz a conta noutra forma (alunos × ICQA × peso × bônus × CH/800 × fração de dias); os testes provam que as duas formas
 * chegam ao mesmo número, e a tela `/conferencia/quarta-fase` mostra isso ciclo a ciclo contra o arquivo.
 *
 * Cada função aqui é a fórmula da linha 4 da planilha, na mesma ordem. Onde o texto do cabeçalho diz uma coisa e a
 * fórmula faz outra, vale a fórmula (é ela que gera o número), e a diferença fica anotada em `COLUNAS_QUARTA_FASE`.
 */
import { decomporMatriculaTotal, type CicloParaCalculo, type PeriodoPnp } from "./matriculaTotal";
import { alunosContadosPelaMdo, chMatrizPorRegra, dataDeJubilamento } from "./regrasCiclo";

const MS_DIA = 86_400_000;

/** As colunas de entrada de uma linha, como vêm no arquivo. */
export interface EntradaQuartaFase {
  tipoCurso: string;
  tipoOferta: string;
  agropecuaria: boolean;
  /** DIC, coluna N. */
  inicio: Date;
  /** DTC, coluna O. */
  termino: Date;
  /** CHC, coluna Q. */
  chCiclo: number;
  /** CHMC, coluna R. */
  chMec: number;
  /** PC, coluna T. */
  peso: number;
  /** DIP, coluna AB. */
  inicioPeriodo: Date;
  /** DFP, coluna AC. */
  fimPeriodo: Date;
  /** QTM, coluna AD. */
  matriculas: number;
}

/** As colunas calculadas, com a sigla da planilha. */
export interface ColunasQuartaFase {
  /** P: data de jubilamento. */
  jubilamento: Date;
  /** S */
  chm: number;
  /** U: "SIM" quando o jubilamento é do início do período em diante. */
  apto: boolean;
  /** V */
  qdtc: number;
  /** W */
  chmd: number;
  /** X */
  cha: number;
  /** Y */
  fech: number;
  /** AE a AI */
  dacp: [number, number, number, number, number];
  /** AJ */
  feda: number;
  /** AK */
  fechda: number;
  /** AL */
  mechda: number;
  /** AM */
  mp: number;
  /** AN */
  ba: number;
  /** AO */
  mt: number;
}

/** Diferença em dias entre duas datas, como o Excel faz ao subtrair células de data. */
function dias(ate: Date, de: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / MS_DIA);
}

export function colunasDaQuartaFase(e: EntradaQuartaFase): ColunasQuartaFase {
  const N = e.inicio.getTime();
  const O = e.termino.getTime();
  const AB = e.inicioPeriodo.getTime();
  const AC = e.fimPeriodo.getTime();

  const jubilamento = dataDeJubilamento(e.termino, e.tipoCurso);
  const chm = chMatrizPorRegra(e.tipoCurso, e.tipoOferta, e.chCiclo, e.chMec);
  const apto = !(jubilamento.getTime() < AB);
  const qdtc = dias(e.termino, e.inicio) + 1;
  const chmd = Math.min(chm, e.chCiclo) / qdtc;
  const cha = qdtc > 365 ? chmd * 365 : chm;
  const fech = qdtc > 365 ? cha / 800 : chm / 800;

  const diasDoPeriodo = dias(e.fimPeriodo, e.inicioPeriodo) + 1;
  const dacp1 = N < AB && O > AC ? diasDoPeriodo : 0;
  const dacp2 = N >= AB && O > AC && N < AC ? dias(e.fimPeriodo, e.inicio) + 1 : 0;
  const dacp3 = N < AB && O <= AC && O >= AB ? dias(e.termino, e.inicioPeriodo) + 1 : 0;
  const dacp4 = N >= AB && O <= AC ? qdtc : 0;
  const dacp5 = N < AB && O < AB ? diasDoPeriodo / 2 : 0;

  const feda = (dacp1 + dacp2 + dacp3 + dacp4 + dacp5) / (qdtc >= 365 ? diasDoPeriodo : qdtc);
  const fechda = fech * feda;
  const mechda = dacp5 === 0 ? fechda * e.matriculas : apto ? fechda * (e.matriculas / 2) : 0;
  const mp = mechda * e.peso;
  const ba = e.agropecuaria ? mp * 0.5 : 0;
  const mt = apto ? mp + ba : 0;

  return { jubilamento, chm, apto, qdtc, chmd, cha, fech, dacp: [dacp1, dacp2, dacp3, dacp4, dacp5], feda, fechda, mechda, mp, ba, mt };
}

/** A mesma linha, na forma que o motor do sistema usa. */
export function cicloDoMotor(e: EntradaQuartaFase): { ciclo: CicloParaCalculo; periodo: PeriodoPnp } {
  const jubilamento = dataDeJubilamento(e.termino, e.tipoCurso);
  const periodo = { inicio: e.inicioPeriodo, fim: e.fimPeriodo };
  return {
    periodo,
    ciclo: {
      inicio: e.inicio,
      termino: e.termino,
      jubilamento,
      chCiclo: e.chCiclo,
      chMec: e.chMec,
      chMatriz: chMatrizPorRegra(e.tipoCurso, e.tipoOferta, e.chCiclo, e.chMec),
      peso: e.peso,
      agropecuaria: e.agropecuaria,
      alunos: alunosContadosPelaMdo(e.matriculas, jubilamento, e.inicioPeriodo),
    },
  };
}

/** Matrícula Total pelo motor do sistema (a conta que alimenta as outras telas). */
export function matriculaTotalPeloMotor(e: EntradaQuartaFase): number {
  const { ciclo, periodo } = cicloDoMotor(e);
  return decomporMatriculaTotal(ciclo, periodo).matriculaTotal;
}

/** Chaves das colunas calculadas que a planilha grava (os resultados que o Excel salvou no arquivo). */
export type ChaveColuna =
  | "chm"
  | "qdtc"
  | "chmd"
  | "cha"
  | "fech"
  | "dacp1"
  | "dacp2"
  | "dacp3"
  | "dacp4"
  | "dacp5"
  | "feda"
  | "fechda"
  | "mechda"
  | "mp"
  | "ba"
  | "mt";

export function valorDaColuna(c: ColunasQuartaFase, chave: ChaveColuna): number {
  switch (chave) {
    case "dacp1":
      return c.dacp[0];
    case "dacp2":
      return c.dacp[1];
    case "dacp3":
      return c.dacp[2];
    case "dacp4":
      return c.dacp[3];
    case "dacp5":
      return c.dacp[4];
    default:
      return c[chave];
  }
}

export interface DescricaoColuna {
  chave: ChaveColuna;
  /** Letra da coluna no Excel. */
  letra: string;
  sigla: string;
  nome: string;
  /** A fórmula da linha 4 do arquivo, como está no Excel. */
  formulaExcel: string;
  /** Em palavras, para quem não lê fórmula de Excel. */
  explicacao: string;
  /** Quando o texto do cabeçalho da planilha não diz o mesmo que a fórmula. */
  cabecalhoDiferente?: string;
}

/** As colunas calculadas da aba "Ciclos de Matrículas", na ordem do arquivo. */
export const COLUNAS_QUARTA_FASE: DescricaoColuna[] = [
  {
    chave: "chm",
    letra: "S",
    sigla: "CHM",
    nome: "Carga horária para a matriz",
    formulaExcel:
      'SE(OU(G="QUALIFICACAO PROFISSIONAL (FIC)";G="DOUTORADO");Q;SE(ÉNÚM(PROCURAR("PROEJA";K));2400;SE(K="INTEGRADO";SE(R=800;3000;SE(R=1000;3100;SE(R=1200;3200;R)));R)))',
    explicacao:
      "FIC e doutorado usam a carga horária do próprio ciclo; Proeja vale 2.400 h; integrado vale 3.000, 3.100 ou 3.200 h conforme a mínima do MEC (800, 1.000 ou 1.200 h); os demais usam a mínima do MEC.",
  },
  {
    chave: "qdtc",
    letra: "V",
    sigla: "QDTC",
    nome: "Quantidade de dias do ciclo",
    formulaExcel: "O − N + 1",
    explicacao: "Dias do início ao término previsto do ciclo, contando os dois.",
  },
  {
    chave: "chmd",
    letra: "W",
    sigla: "CHMD",
    nome: "Carga horária média diária",
    formulaExcel: "SE(S>Q;Q;S) / V",
    explicacao: "A menor entre a carga horária da matriz e a do ciclo, dividida pelos dias do ciclo.",
    cabecalhoDiferente: "O cabeçalho diz CHMD = CHM/QDTC; a fórmula usa a menor entre CHM e CHC.",
  },
  {
    chave: "cha",
    letra: "X",
    sigla: "CHA",
    nome: "Carga horária anualizada",
    formulaExcel: "SE(V>365;W*365;S)",
    explicacao: "Ciclo de mais de um ano: as horas de um ano (média diária × 365). Ciclo de até um ano: a carga horária da matriz inteira.",
  },
  {
    chave: "fech",
    letra: "Y",
    sigla: "FECH",
    nome: "Fator de equalização de carga horária",
    formulaExcel: "SE(V>365;X/800;S/800)",
    explicacao: "Quantos “alunos de 800 horas por ano” o aluno deste ciclo vale.",
    cabecalhoDiferente: "O cabeçalho diz CHC/800 para o ciclo curto; a fórmula usa CHM/800.",
  },
  {
    chave: "dacp1",
    letra: "AE",
    sigla: "DACP1",
    nome: "Dias ativos: começa antes e termina depois do período",
    formulaExcel: "SE(E(N<AB;O>AC);AC−AB+1;0)",
    explicacao: "O ciclo cobre o ano-base inteiro.",
  },
  {
    chave: "dacp2",
    letra: "AF",
    sigla: "DACP2",
    nome: "Dias ativos: começa dentro e termina depois do período",
    formulaExcel: "SE(E(N>=AB;O>AC;N<AC);AC−N+1;0)",
    explicacao: "Do início do ciclo até o fim do ano-base.",
  },
  {
    chave: "dacp3",
    letra: "AG",
    sigla: "DACP3",
    nome: "Dias ativos: começa antes e termina dentro do período",
    formulaExcel: "SE(E(N<AB;O<=AC;O>=AB);O−AB+1;0)",
    explicacao: "Do início do ano-base até o término do ciclo.",
  },
  {
    chave: "dacp4",
    letra: "AH",
    sigla: "DACP4",
    nome: "Dias ativos: começa e termina dentro do período",
    formulaExcel: "SE(E(N>=AB;O<=AC);O−N+1;0)",
    explicacao: "O ciclo inteiro cabe no ano-base.",
  },
  {
    chave: "dacp5",
    letra: "AI",
    sigla: "DACP5",
    nome: "Dias ativos: terminou antes do período (aluno retido)",
    formulaExcel: "SE(E(N<AB;O<AB);(AC−AB+1)/2;0)",
    explicacao: "O ciclo já devia ter terminado: conta meio ano-base (182,5 dias, ou 183 em ano bissexto).",
  },
  {
    chave: "feda",
    letra: "AJ",
    sigla: "FEDA",
    nome: "Fator de equalização de dias ativos",
    formulaExcel: "SOMA(AE:AI) / SE(V>=365;AC−AB+1;V)",
    explicacao: "Que fração do ano o ciclo esteve ativo. No ciclo de menos de um ano, a fração é dos dias do próprio ciclo.",
    cabecalhoDiferente: "O cabeçalho diz que divide pelos dias do período; a fórmula divide pelos dias do ciclo quando ele tem menos de 365 dias.",
  },
  {
    chave: "fechda",
    letra: "AK",
    sigla: "FECHDA",
    nome: "Fator de carga horária e dias ativos",
    formulaExcel: "Y * AJ",
    explicacao: "FECH × FEDA: quanto de um “aluno de 800 horas por ano” cada matrícula vale neste ano-base.",
  },
  {
    chave: "mechda",
    letra: "AL",
    sigla: "MECHDA",
    nome: "Matrículas equalizadas",
    formulaExcel: 'SE(AI=0;AK*AD;SE(U="SIM";AK*(AD/2);0))',
    explicacao: "FECHDA × matrículas. Se o aluno está retido, conta metade das matrículas; se já passou do jubilamento, zero.",
    cabecalhoDiferente: "O cabeçalho cita “DIP − DTC > 1095”; a fórmula usa a coluna U (data de jubilamento), que no FIC é o próprio término.",
  },
  {
    chave: "mp",
    letra: "AM",
    sigla: "MP",
    nome: "Matrículas ponderadas",
    formulaExcel: "AL * T",
    explicacao: "MECHDA × peso do curso.",
  },
  {
    chave: "ba",
    letra: "AN",
    sigla: "BA",
    nome: "Bônus agropecuária",
    formulaExcel: 'SE(J="SIM";AM*50%;0)',
    explicacao: "Mais 50% das matrículas ponderadas nos cursos de agropecuária.",
  },
  {
    chave: "mt",
    letra: "AO",
    sigla: "MT",
    nome: "Matrícula Total",
    formulaExcel: 'SE(U="SIM";AM+AN;0)',
    explicacao: "MP + BA, se o ciclo está apto (jubilamento do início do período em diante).",
  },
];

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 });
const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const f = (v: number) => fmt.format(v);
const d = (v: Date) => dia.format(v);

/**
 * A conta de uma coluna com os números da linha, como se lê em voz alta numa reunião ("1.416 dias: 23/12/2021 − 07/02/2018
 * + 1"). É o que a tela mostra ao lado do valor, para ninguém precisar abrir o Excel para saber de onde ele veio.
 */
export function contaDaColuna(chave: ChaveColuna, e: EntradaQuartaFase, c: ColunasQuartaFase): string {
  const diasDoPeriodo = Math.round((e.fimPeriodo.getTime() - e.inicioPeriodo.getTime()) / MS_DIA) + 1;
  switch (chave) {
    case "chm": {
      const tipo = e.tipoCurso.toUpperCase();
      const oferta = e.tipoOferta.toUpperCase();
      if (tipo.startsWith("QUALIFICA") || tipo === "DOUTORADO") return `${tipo.startsWith("QUALIFICA") ? "FIC" : "Doutorado"}: usa a carga horária do ciclo (CHC) = ${f(c.chm)} h`;
      if (oferta.includes("PROEJA")) return `Proeja: ${f(c.chm)} h`;
      if (oferta === "INTEGRADO" && c.chm !== e.chMec) return `Integrado com mínima do MEC de ${f(e.chMec)} h: ${f(c.chm)} h`;
      return `Carga horária mínima do MEC (CHMC) = ${f(c.chm)} h`;
    }
    case "qdtc":
      return `${d(e.termino)} − ${d(e.inicio)} + 1 = ${f(c.qdtc)} dias`;
    case "chmd":
      return `menor entre CHM (${f(c.chm)}) e CHC (${f(e.chCiclo)}) ÷ QDTC = ${f(Math.min(c.chm, e.chCiclo))} ÷ ${f(c.qdtc)} = ${f(c.chmd)}`;
    case "cha":
      return c.qdtc > 365 ? `QDTC maior que 365: CHMD × 365 = ${f(c.chmd)} × 365 = ${f(c.cha)}` : `QDTC até 365: CHA = CHM = ${f(c.cha)}`;
    case "fech":
      return c.qdtc > 365 ? `CHA ÷ 800 = ${f(c.cha)} ÷ 800 = ${f(c.fech)}` : `CHM ÷ 800 = ${f(c.chm)} ÷ 800 = ${f(c.fech)}`;
    case "dacp1":
      return c.dacp[0] ? `cobre o ano-base inteiro: ${d(e.fimPeriodo)} − ${d(e.inicioPeriodo)} + 1 = ${f(c.dacp[0])}` : "não se aplica: 0";
    case "dacp2":
      return c.dacp[1] ? `${d(e.fimPeriodo)} − ${d(e.inicio)} + 1 = ${f(c.dacp[1])}` : "não se aplica: 0";
    case "dacp3":
      return c.dacp[2] ? `${d(e.termino)} − ${d(e.inicioPeriodo)} + 1 = ${f(c.dacp[2])}` : "não se aplica: 0";
    case "dacp4":
      return c.dacp[3] ? `o ciclo inteiro, QDTC = ${f(c.dacp[3])}` : "não se aplica: 0";
    case "dacp5":
      return c.dacp[4] ? `aluno retido, meio ano-base: ${f(diasDoPeriodo)} ÷ 2 = ${f(c.dacp[4])}` : "não se aplica: 0";
    case "feda": {
      const soma = c.dacp.reduce((s, x) => s + x, 0);
      const divisor = c.qdtc >= 365 ? diasDoPeriodo : c.qdtc;
      return `soma dos DACP ÷ ${c.qdtc >= 365 ? "dias do período" : "dias do ciclo"} = ${f(soma)} ÷ ${f(divisor)} = ${f(c.feda)}`;
    }
    case "fechda":
      return `FECH × FEDA = ${f(c.fech)} × ${f(c.feda)} = ${f(c.fechda)}`;
    case "mechda":
      if (c.dacp[4] === 0) return `FECHDA × QTM = ${f(c.fechda)} × ${f(e.matriculas)} = ${f(c.mechda)}`;
      return c.apto
        ? `retido dentro do prazo: FECHDA × QTM ÷ 2 = ${f(c.fechda)} × ${f(e.matriculas)} ÷ 2 = ${f(c.mechda)}`
        : `retido e jubilado em ${d(c.jubilamento)}: 0`;
    case "mp":
      return `MECHDA × PC = ${f(c.mechda)} × ${f(e.peso)} = ${f(c.mp)}`;
    case "ba":
      return e.agropecuaria ? `agropecuária: MP × 50% = ${f(c.mp)} × 0,5 = ${f(c.ba)}` : "não é curso de agropecuária: 0";
    case "mt":
      return c.apto ? `MP + BA = ${f(c.mp)} + ${f(c.ba)} = ${f(c.mt)}` : `não apto (jubilamento em ${d(c.jubilamento)}, antes do ano-base): 0`;
  }
}
