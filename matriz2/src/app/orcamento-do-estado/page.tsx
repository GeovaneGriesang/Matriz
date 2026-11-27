import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";
import { FUNCOES_DE_GOVERNO } from "@/lib/orcamento/siconfi";
import { DOCUMENTOS_RS } from "@/lib/orcamento/documentosOficiais";
import { balancoDoAno, funcoesDoAno, serieDoEnte } from "@/server/queries/orcamentoPublico";
import { ComoFuncionaOOrcamento } from "@/components/orcamentoPublico/ComoFuncionaOOrcamento";
import { ExecucaoPorFuncao } from "@/components/orcamentoPublico/ExecucaoPorFuncao";
import { BalancoDoAno, Cartao, SerieAnual, milhoes, pct } from "@/components/orcamentoPublico/SerieAnual";
import { TabelaAgrupada, type GrupoAgrupado, type VisaoAgrupada } from "@/components/orcamentoPublico/TabelaAgrupada";
import { DocumentosOficiais } from "@/components/orcamentoPublico/DocumentosOficiais";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** O nome de uma função de governo pelo código (1 a 28), com acento; 99 é a reserva. */
const nomeDaFuncao = (codigo: number, nome: string) => (codigo >= 1 && codigo <= 28 ? FUNCOES_DE_GOVERNO[codigo - 1]! : codigo === 99 ? "Reserva orçamentária" : nome);

/** Agrupa linhas por uma chave e lista as partes de cada grupo (as maiores primeiro, até `max`, e o resto somado em "demais"). */
function agrupar<T>(linhas: T[], valor: (l: T) => number, grupo: (l: T) => string, parte: (l: T) => string, opcoes: { max?: number; destaque?: (g: string) => boolean; nota?: (g: string) => string | undefined } = {}): GrupoAgrupado[] {
  const max = opcoes.max ?? 25;
  const m = new Map<string, Map<string, number>>();
  for (const l of linhas) {
    const g = grupo(l);
    const p = parte(l);
    const partes = m.get(g) ?? new Map<string, number>();
    partes.set(p, (partes.get(p) ?? 0) + valor(l));
    m.set(g, partes);
  }
  return [...m.entries()]
    .map(([g, partes]) => {
      const ordenadas = [...partes.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      const filhos = ordenadas.slice(0, max).map(([rotulo, v]) => ({ rotulo, valor: v }));
      const resto = ordenadas.slice(max).reduce((s, [, v]) => s + v, 0);
      if (ordenadas.length > max) filhos.push({ rotulo: `demais ${ordenadas.length - max}`, valor: resto });
      return { chave: g, rotulo: g, valor: ordenadas.reduce((s, [, v]) => s + v, 0), filhos, destaque: opcoes.destaque?.(g), nota: opcoes.nota?.(g) };
    })
    .sort((a, b) => b.valor - a.valor);
}

/** A origem da receita pelos dois primeiros dígitos da natureza (classificação nacional da receita). */
const ORIGEM: Record<string, string> = {
  "11": "Impostos, taxas e contribuição de melhoria",
  "12": "Contribuições",
  "13": "Receita patrimonial",
  "14": "Receita agropecuária",
  "15": "Receita industrial",
  "16": "Receita de serviços",
  "17": "Transferências correntes (da União e outros)",
  "19": "Outras receitas correntes",
  "21": "Operações de crédito (empréstimos)",
  "22": "Venda de bens",
  "23": "Amortização de empréstimos concedidos",
  "24": "Transferências de capital",
  "29": "Outras receitas de capital",
};
function origemDaReceita(codigo: string, nome: string): string {
  const d2 = codigo.replace(/\D/g, "").slice(0, 2);
  if (d2.startsWith("7") || d2.startsWith("8")) return "Receitas intraorçamentárias (de um órgão do Estado para outro)";
  if (d2.startsWith("9")) {
    if (/MUNIC|\s-\s?M$/i.test(nome)) return "Dedução: parte dos municípios (ICMS, IPVA e outros)";
    if (/FUNDEB|\s-\s?F$/i.test(nome)) return "Dedução: parte que vai para o FUNDEB";
    return "Dedução: outras (devoluções e restituições)";
  }
  return ORIGEM[d2] ?? `Outras (${d2})`;
}

export default async function OrcamentoDoEstadoPage() {
  await requireAcessoPlenoOrRedirect("/orcamento-do-estado");

  const exercicioProposta = 2027;
  const [despesa, receita, serie] = await Promise.all([
    prisma.orcamentoEstadualDespesa.findMany({ where: { exercicio: exercicioProposta, documento: "PLOA" } }),
    prisma.orcamentoEstadualReceita.findMany({ where: { exercicio: exercicioProposta, documento: "PLOA" } }),
    serieDoEnte("RS"),
  ]);
  const anoAtual = serie[serie.length - 1];
  const [funcoes, balanco] = anoAtual ? await Promise.all([funcoesDoAno("RS", anoAtual.exercicio), balancoDoAno("RS", anoAtual.exercicio)]) : [[], new Map()];

  if (despesa.length === 0 && serie.length === 0) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-4 px-6 py-12 lg:px-12`}>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Orçamento do Estado do RS</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Ainda não foi carregado. Rode <code>npm run carregar:orcamento-rs -- 2027</code> e <code>npm run carregar:siconfi -- 2015 2026</code>.
        </p>
      </main>
    );
  }

  const v = (l: { valor: unknown }) => Number(l.valor);
  const despesaTotal = despesa.reduce((s, l) => s + v(l), 0);
  const receitaTotal = receita.reduce((s, l) => s + v(l), 0);
  const intra = receita.filter((r) => /^[78]/.test(r.codigo)).reduce((s, l) => s + v(l), 0);
  const paraMunicipios = -receita.filter((r) => origemDaReceita(r.codigo, r.nome).includes("municípios")).reduce((s, l) => s + v(l), 0);
  const ehEducacao = (g: string) => g === "Educação";
  const educacao = despesa.filter((l) => l.funcaoCodigo === 12);
  const educacaoTotal = educacao.reduce((s, l) => s + v(l), 0);

  const visoesDespesa: VisaoAgrupada[] = [
    {
      id: "funcao",
      rotulo: "Por área (função)",
      explicacao: "A mesma classificação usada pela União e pelos municípios. O + abre as subfunções, as partes de cada área.",
      colunaGrupo: "Área",
      colunaFilho: "Subfunção",
      grupos: agrupar(despesa, v, (l) => nomeDaFuncao(l.funcaoCodigo, l.funcaoNome), (l) => l.subfuncaoNome, { destaque: ehEducacao }),
    },
    {
      id: "orgao",
      rotulo: "Por órgão",
      explicacao: "Secretarias, autarquias, fundações, poderes (Judiciário, Assembleia, Ministério Público) e os encargos gerais. O + abre as ações (projetos e atividades) de cada órgão.",
      colunaGrupo: "Órgão",
      colunaFilho: "Ação (projeto ou atividade)",
      grupos: agrupar(despesa, v, (l) => l.orgaoNome, (l) => `${l.acaoCodigo} ${l.acaoNome}`, { destaque: (g) => g === "SECRETARIA DA EDUCACAO" }),
    },
    {
      id: "grupo",
      rotulo: "Por grupo de despesa",
      explicacao: "No que o dinheiro é gasto: pessoal, custeio, investimento, dívida. O + mostra que órgãos gastam em cada grupo.",
      colunaGrupo: "Grupo de despesa",
      colunaFilho: "Órgão",
      grupos: agrupar(despesa, v, (l) => l.grupoNome, (l) => l.orgaoNome, { max: 15 }),
    },
    {
      id: "fonte",
      rotulo: "Por fonte de recurso",
      explicacao: "De que dinheiro sai cada despesa. \"Recursos não vinculados de impostos\" é o dinheiro livre; as outras fontes têm destino obrigatório (educação, saúde, previdência, convênios).",
      colunaGrupo: "Fonte de recurso",
      colunaFilho: "Órgão",
      grupos: agrupar(despesa, v, (l) => `${l.fonteCodigo} ${l.fonteNome}`, (l) => l.orgaoNome, { max: 15 }),
    },
  ];
  const visoesEducacao: VisaoAgrupada[] = [
    {
      id: "subfuncao",
      rotulo: "Por etapa de ensino (subfunção)",
      explicacao: "A educação do projeto de 2027, etapa por etapa. Ensino profissional e ensino superior são as partes mais próximas do que o IFSul faz. O + abre as ações.",
      colunaGrupo: "Subfunção",
      colunaFilho: "Ação e órgão",
      grupos: agrupar(educacao, v, (l) => l.subfuncaoNome, (l) => `${l.acaoNome} (${l.orgaoNome})`, { destaque: (g) => /PROFISSIONAL|SUPERIOR/.test(g) }),
    },
    {
      id: "orgaoEdu",
      rotulo: "Por órgão",
      explicacao: "Quem gasta a verba da educação: a Secretaria da Educação, a universidade estadual (UERGS) e os encargos de pessoal e previdência da área. O + abre as ações.",
      colunaGrupo: "Órgão",
      colunaFilho: "Ação",
      grupos: agrupar(educacao, v, (l) => l.orgaoNome, (l) => `${l.acaoCodigo} ${l.acaoNome}`),
    },
  ];
  const visoesReceita: VisaoAgrupada[] = [
    {
      id: "origem",
      rotulo: "Por origem",
      explicacao:
        "De onde vem o dinheiro. As deduções aparecem negativas: são a parte de cada imposto que a Constituição manda entregar aos municípios (25% do ICMS e 50% do IPVA) e ao FUNDEB, o fundo da educação básica. O + abre cada receita.",
      colunaGrupo: "Origem",
      colunaFilho: "Receita",
      grupos: agrupar(receita, v, (r) => origemDaReceita(r.codigo, r.nome), (r) => r.nome, { max: 20 }),
    },
  ];

  const documentos = DOCUMENTOS_RS;
  const textoParaOChat = [
    "Orçamento do Estado do Rio Grande do Sul.",
    `Projeto de 2027: despesa ${reais.format(despesaTotal)}, receita ${reais.format(receitaTotal)}, intraorçamentárias ${reais.format(intra)}; educação ${reais.format(educacaoTotal)}; parte dos municípios nos impostos ${reais.format(paraMunicipios)}.`,
    ...serie.map((r) => `${r.exercicio} (até o ${r.periodo}º bimestre): receita arrecadada ${reais.format(r.receita.realizado)}, despesa empenhada ${reais.format(r.despesa.empenhado)}, educação ${reais.format(r.educacao.empenhado)}, saúde ${reais.format(r.saude.empenhado)}.`),
  ].join("\n");

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-8 px-6 py-12 lg:px-12`}>
      <ContextoDaTela texto={textoParaOChat} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Orçamento do Estado do Rio Grande do Sul</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Quanto o Estado arrecada e gasta, em que áreas, e o que ele propõe para 2027. O IFSul é federal e não recebe deste orçamento: a tela serve para entender o
          ambiente em que os câmpus estão (a rede estadual de ensino técnico, a universidade estadual, os repasses aos municípios) e para comparar com o{" "}
          <Link href="/orcamento-da-uniao" className={PROSE_LINK}>
            orçamento da União
          </Link>
          .
        </p>
      </div>

      <ComoFuncionaOOrcamento
        quem="O Estado do Rio Grande do Sul"
        poderLegislativo="pela Assembleia Legislativa"
        prazos="O governador envia o projeto da LOA até 15 de setembro e a Assembleia vota até o fim do ano. O PPA em vigor vai de 2024 a 2027."
      />

      {despesa.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">O projeto para {exercicioProposta} (PLOA)</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            A proposta que o governador enviou à Assembleia em setembro de 2026, linha a linha, da planilha oficial da Secretaria de Planejamento. Os totais conferem
            com a mensagem do governador.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao titulo="Despesa fixada" valor={milhoes(despesaTotal)} nota={`${reais.format(despesaTotal - intra)} sem a dupla contagem (as intraorçamentárias)`} />
            <Cartao titulo="Receita estimada" valor={milhoes(receitaTotal)} nota={`${reais.format(receitaTotal - intra)} sem a dupla contagem`} />
            <Cartao
              titulo={receitaTotal < despesaTotal ? "Déficit previsto" : "Superávit previsto"}
              valor={milhoes(receitaTotal - despesaTotal)}
              destaque={receitaTotal < despesaTotal ? "ruim" : "bom"}
              nota="receita menos despesa; o Estado propõe gastar mais do que espera arrecadar"
            />
            <Cartao titulo="Educação" valor={milhoes(educacaoTotal)} nota={`${pct(educacaoTotal, despesaTotal)} da despesa total`} />
          </div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Para onde vai o dinheiro</h3>
          <TabelaAgrupada visoes={visoesDespesa} total={despesaTotal} rotuloTotal="Despesa total do projeto" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">A educação em detalhe</h3>
          <TabelaAgrupada visoes={visoesEducacao} total={educacaoTotal} rotuloTotal="Educação, total" />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">De onde vem o dinheiro</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Do que o Estado arrecada, {reais.format(paraMunicipios)} são a parte dos municípios, entregue por lei. É por aí que Venâncio Aires e as demais cidades
            recebem o ICMS e o IPVA.
          </p>
          <TabelaAgrupada visoes={visoesReceita} total={receitaTotal} rotuloTotal="Receita total do projeto" />
          <p className="text-xs text-neutral-500">Fonte: {despesa[0]!.fonte}; {receita[0]?.fonte ?? "planilha de receitas não carregada"}.</p>
        </section>
      )}

      {anoAtual && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Como está {anoAtual.exercicio}, até o {anoAtual.periodo}º bimestre
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Do relatório que o Estado entrega ao Tesouro Nacional a cada dois meses (RREO). O {anoAtual.periodo}º bimestre vai até o fim de{" "}
            {["fevereiro", "abril", "junho", "agosto", "outubro", "dezembro"][anoAtual.periodo - 1]}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao titulo="Receita arrecadada" valor={milhoes(anoAtual.receita.realizado)} nota={`${pct(anoAtual.receita.realizado, anoAtual.receita.previsaoAtualizada)} do previsto para o ano`} />
            <Cartao titulo="Despesa empenhada" valor={milhoes(anoAtual.despesa.empenhado)} nota={`${pct(anoAtual.despesa.empenhado, anoAtual.despesa.dotacaoAtualizada)} da dotação atualizada`} />
            <Cartao titulo="Liquidada" valor={milhoes(anoAtual.despesa.liquidado)} nota="serviço prestado ou bem entregue" />
            <Cartao titulo="Paga" valor={milhoes(anoAtual.despesa.pago)} nota="dinheiro que saiu do caixa" />
          </div>
          <BalancoDoAno balanco={balanco} />
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Por área</h3>
          <ExecucaoPorFuncao funcoes={funcoes} ano={anoAtual.exercicio} periodo={anoAtual.periodo} />
          <p className="text-xs text-neutral-500">Fonte: {anoAtual.fonte}, Anexos 1 e 2.</p>
        </section>
      )}

      {serie.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Ano a ano, de {serie[0]!.exercicio} a {serie[serie.length - 1]!.exercicio}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            O fechamento de cada ano (6º bimestre do RREO). A Constituição manda o Estado aplicar pelo menos 25% dos impostos em educação e 12% em saúde; a conta oficial
            desses mínimos usa só a receita de impostos, por isso a parte mostrada aqui (sobre a despesa total) é menor que o percentual legal.
          </p>
          <SerieAnual serie={serie} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Documentos oficiais</h2>
        <DocumentosOficiais documentos={documentos} />
      </section>
    </main>
  );
}
