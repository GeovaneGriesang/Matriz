import { prisma } from "@/server/db/prisma";
import { ANEXO_BALANCO, ANEXO_FUNCAO, type Ente } from "@/lib/orcamento/siconfi";

/**
 * Consultas das telas do orçamento do Estado do RS e do município de Venâncio Aires, a partir do RREO entregue ao Tesouro (tabela
 * ContaSiconfi). Todos os valores ficam sem as despesas e receitas intraorçamentárias, que são pagamentos de um órgão a outro do
 * mesmo ente e contariam duas vezes.
 */

export interface ColunasDaDespesa {
  dotacaoInicial: number;
  dotacaoAtualizada: number;
  empenhado: number;
  liquidado: number;
  pago: number;
}

export interface ColunasDaReceita {
  previsaoInicial: number;
  previsaoAtualizada: number;
  realizado: number;
}

export interface ResumoDoAno {
  exercicio: number;
  periodo: number;
  receita: ColunasDaReceita;
  despesa: ColunasDaDespesa;
  educacao: ColunasDaDespesa;
  saude: ColunasDaDespesa;
  fonte: string;
}

export interface LinhaDeFuncao extends ColunasDaDespesa {
  nome: string;
  subfuncoes: (ColunasDaDespesa & { nome: string })[];
}

export interface LinhaDoBalanco {
  codConta: string;
  nome: string;
  receita?: ColunasDaReceita;
  despesa?: ColunasDaDespesa;
}

const zeroDespesa = (): ColunasDaDespesa => ({ dotacaoInicial: 0, dotacaoAtualizada: 0, empenhado: 0, liquidado: 0, pago: 0 });
const zeroReceita = (): ColunasDaReceita => ({ previsaoInicial: 0, previsaoAtualizada: 0, realizado: 0 });

type Linha = { exercicio: number; periodo: number; anexo: string; ordem: number; codConta: string; conta: string; nivel: string; funcao: string | null; coluna: string; valor: unknown; fonte: string };

function preencher<T extends object>(alvo: T, coluna: string, valor: number) {
  if (coluna in alvo) (alvo as Record<string, number>)[coluna] = valor;
}

/** A série de todos os anos carregados: receita, despesa, educação e saúde. */
export async function serieDoEnte(ente: Ente): Promise<ResumoDoAno[]> {
  const linhas = (await prisma.contaSiconfi.findMany({
    where: {
      ente,
      OR: [
        { anexo: ANEXO_BALANCO, codConta: { in: ["ReceitasExcetoIntraOrcamentarias", "DespesasExcetoIntraOrcamentarias"] } },
        { anexo: ANEXO_FUNCAO, nivel: "funcao" },
      ],
    },
  })) as Linha[];
  const porAno = new Map<number, ResumoDoAno>();
  for (const l of linhas) {
    const r = porAno.get(l.exercicio) ?? { exercicio: l.exercicio, periodo: l.periodo, receita: zeroReceita(), despesa: zeroDespesa(), educacao: zeroDespesa(), saude: zeroDespesa(), fonte: l.fonte };
    const v = Number(l.valor);
    if (l.anexo === ANEXO_BALANCO && l.codConta === "ReceitasExcetoIntraOrcamentarias") preencher(r.receita, l.coluna, v);
    else if (l.anexo === ANEXO_BALANCO) preencher(r.despesa, l.coluna, v);
    else if (/^educa/i.test(l.conta)) preencher(r.educacao, l.coluna, v);
    else if (/^sa[uú]de$/i.test(l.conta)) preencher(r.saude, l.coluna, v);
    porAno.set(l.exercicio, r);
  }
  return [...porAno.values()].sort((a, b) => a.exercicio - b.exercicio);
}

/** A despesa do ano por função, com as subfunções de cada uma, da maior para a menor (pela dotação atualizada). */
export async function funcoesDoAno(ente: Ente, exercicio: number): Promise<LinhaDeFuncao[]> {
  const linhas = (await prisma.contaSiconfi.findMany({ where: { ente, exercicio, anexo: ANEXO_FUNCAO, nivel: { in: ["funcao", "subfuncao"] } }, orderBy: { ordem: "asc" } })) as Linha[];
  const funcoes = new Map<string, LinhaDeFuncao>();
  const subs = new Map<string, ColunasDaDespesa & { nome: string; funcao: string }>();
  for (const l of linhas) {
    const v = Number(l.valor);
    if (l.nivel === "funcao") {
      const f = funcoes.get(l.conta) ?? { nome: l.conta, ...zeroDespesa(), subfuncoes: [] };
      preencher(f, l.coluna, v);
      funcoes.set(l.conta, f);
    } else if (l.funcao) {
      const k = `${l.funcao}|${l.conta}`;
      const s = subs.get(k) ?? { nome: l.conta.replace(/^FU\d+ - /, ""), funcao: l.funcao, ...zeroDespesa() };
      preencher(s, l.coluna, v);
      subs.set(k, s);
    }
  }
  for (const s of subs.values()) funcoes.get(s.funcao)?.subfuncoes.push(s);
  for (const f of funcoes.values()) f.subfuncoes.sort((a, b) => b.dotacaoAtualizada - a.dotacaoAtualizada);
  return [...funcoes.values()].sort((a, b) => b.dotacaoAtualizada - a.dotacaoAtualizada);
}

/** As contas do balanço orçamentário (Anexo 01) do ano, por código. */
export async function balancoDoAno(ente: Ente, exercicio: number): Promise<Map<string, LinhaDoBalanco>> {
  const linhas = (await prisma.contaSiconfi.findMany({ where: { ente, exercicio, anexo: ANEXO_BALANCO } })) as Linha[];
  const m = new Map<string, LinhaDoBalanco>();
  for (const l of linhas) {
    const b = m.get(l.codConta) ?? { codConta: l.codConta, nome: l.conta };
    if (l.nivel === "receita") preencher((b.receita ??= zeroReceita()), l.coluna, Number(l.valor));
    else preencher((b.despesa ??= zeroDespesa()), l.coluna, Number(l.valor));
    m.set(l.codConta, b);
  }
  return m;
}
