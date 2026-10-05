import { dividirLinha } from "@/lib/pnp/csvPainel";

/**
 * Leitura dos arquivos do Portal da Transparência (CGU): "Despesas" mensal (execução por unidade gestora) e "Orçamento da despesa"
 * (inicial, atualizado, empenhado e realizado por ação). Ponto e vírgula, tudo entre aspas, decimal com vírgula, codificação Latin-1.
 * Só funções puras, para poderem ser testadas sem arquivo.
 */

/** As ações que formam o dinheiro que a matriz distribui. As demais são pessoal, benefícios e encargos. */
export const ACOES_DA_EXECUCAO = ["20RL", "2994", "20RG"] as const;

/**
 * Código SIAFI de cada unidade gestora do IFSul e o nome da unidade cadastrada no sistema. O código é estável; o nome da UG no Portal vem
 * abreviado ("INST.FED.SUL-RIO-GRANDENSE/C NOVO HAMBURGO") e mudaria o casamento a cada reescrita.
 */
export const UG_DO_IFSUL: Record<string, string> = {
  "151878": "CAMPUS CAMAQUÃ",
  "151879": "CAMPUS BAGÉ",
  "151895": "CAMPUS PELOTAS VISCONDE DA GRAÇA",
  "151964": "CAMPUS VENÂNCIO AIRES",
  "154773": "CAMPUS SANTANA DO LIVRAMENTO",
  "155143": "CAMPUS GRAVATAÍ",
  "155144": "CAMPUS LAJEADO",
  "155146": "CAMPUS SAPIRANGA",
  "157235": "CAMPUS NOVO HAMBURGO",
  "158126": "REITORIA",
  "158338": "CAMPUS PASSO FUNDO",
  "158339": "CAMPUS SAPUCAIA DO SUL",
  "158340": "CAMPUS CHARQUEADAS",
  "158467": "CAMPUS PELOTAS",
  "158759": "CAMPUS JAGUARÃO",
};

export function numeroDoPortal(bruto: string | undefined): number {
  const n = Number((bruto ?? "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export interface ExecucaoMensal {
  ano: number;
  mes: number;
  ugCodigo: string;
  ugNome: string;
  acao: string;
  empenhado: number;
  liquidado: number;
  pago: number;
}

/**
 * Soma a execução de um órgão subordinado por UG, mês e ação, só das ações pedidas. Vários planos orçamentários e naturezas de despesa
 * da mesma UG e ação viram uma linha. Linhas de outros órgãos são descartadas antes de dividir (o arquivo tem 50 mil linhas por mês).
 */
export function lerExecucaoMensal(texto: string, orgaoSubordinado: string, acoes: readonly string[] = ACOES_DA_EXECUCAO): ExecucaoMensal[] {
  const linhas = texto.split(/\r?\n/);
  const cab = dividirLinha(linhas[0] ?? "");
  const i = (nome: string) => {
    const ix = cab.indexOf(nome);
    if (ix < 0) throw new Error(`Coluna "${nome}" não encontrada no arquivo de despesas do Portal da Transparência.`);
    return ix;
  };
  const col = {
    mes: i("Ano e mês do lançamento"),
    orgao: i("Código Órgão Subordinado"),
    ug: i("Código Unidade Gestora"),
    ugNome: i("Nome Unidade Gestora"),
    acao: i("Código Ação"),
    empenhado: i("Valor Empenhado (R$)"),
    liquidado: i("Valor Liquidado (R$)"),
    pago: i("Valor Pago (R$)"),
  };
  const marca = `"${orgaoSubordinado}"`;
  const soma = new Map<string, ExecucaoMensal>();
  for (const linha of linhas.slice(1)) {
    if (!linha.includes(marca)) continue;
    const c = dividirLinha(linha);
    if (c[col.orgao] !== orgaoSubordinado || !acoes.includes(c[col.acao]!)) continue;
    const [ano, mes] = (c[col.mes] ?? "").split("/").map(Number);
    if (!ano || !mes) continue;
    const chave = `${ano}/${mes}/${c[col.ug]}/${c[col.acao]}`;
    const a = soma.get(chave) ?? { ano, mes, ugCodigo: c[col.ug]!, ugNome: c[col.ugNome]!, acao: c[col.acao]!, empenhado: 0, liquidado: 0, pago: 0 };
    a.empenhado += numeroDoPortal(c[col.empenhado]);
    a.liquidado += numeroDoPortal(c[col.liquidado]);
    a.pago += numeroDoPortal(c[col.pago]);
    soma.set(chave, a);
  }
  return [...soma.values()];
}

export interface OrcamentoPorAcao {
  exercicio: number;
  acao: string;
  acaoDescricao: string;
  inicial: number;
  atualizado: number;
  empenhado: number;
  realizado: number;
}

/** Soma o "Orçamento da despesa" de um órgão subordinado por ação (o arquivo vem por elemento de despesa). */
export function lerOrcamentoPorAcao(texto: string, orgaoSubordinado: string): OrcamentoPorAcao[] {
  const linhas = texto.split(/\r?\n/);
  const cab = dividirLinha(linhas[0] ?? "");
  const i = (nome: string) => {
    const ix = cab.indexOf(nome);
    if (ix < 0) throw new Error(`Coluna "${nome}" não encontrada no arquivo de orçamento da despesa do Portal da Transparência.`);
    return ix;
  };
  const col = {
    exercicio: i("EXERCÍCIO"),
    orgao: i("CÓDIGO ÓRGÃO SUBORDINADO"),
    acao: i("CÓDIGO AÇÃO"),
    nome: i("NOME AÇÃO"),
    inicial: i("ORÇAMENTO INICIAL (R$)"),
    atualizado: i("ORÇAMENTO ATUALIZADO (R$)"),
    empenhado: i("ORÇAMENTO EMPENHADO (R$)"),
    realizado: i("ORÇAMENTO REALIZADO (R$)"),
  };
  const marca = `"${orgaoSubordinado}"`;
  const soma = new Map<string, OrcamentoPorAcao>();
  for (const linha of linhas.slice(1)) {
    if (!linha.includes(marca)) continue;
    const c = dividirLinha(linha);
    if (c[col.orgao] !== orgaoSubordinado) continue;
    const exercicio = Number(c[col.exercicio]);
    const chave = `${exercicio}/${c[col.acao]}`;
    const a = soma.get(chave) ?? { exercicio, acao: c[col.acao]!, acaoDescricao: c[col.nome]!, inicial: 0, atualizado: 0, empenhado: 0, realizado: 0 };
    a.inicial += numeroDoPortal(c[col.inicial]);
    a.atualizado += numeroDoPortal(c[col.atualizado]);
    a.empenhado += numeroDoPortal(c[col.empenhado]);
    a.realizado += numeroDoPortal(c[col.realizado]);
    soma.set(chave, a);
  }
  return [...soma.values()];
}

/** Nome da UG para mostrar: "INST.FED.SUL-RIO-GRANDENSE/CAMPUS PELOTAS" vira "CAMPUS PELOTAS". */
export function nomeDaUg(ugNome: string): string {
  return ugNome.replace(/^INST\.FED\.[^/]*\//, "").trim();
}
