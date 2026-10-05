import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inteiro = new Intl.NumberFormat("pt-BR");

/** O que o texto de cada documento chama de cada coluna. A ordem é a da leitura: do mais antigo ao mais novo. */
const COLUNAS_TOTAIS = [
  { documento: "EMPENHADO", exercicio: 2024, rotulo: "Empenhado 2024" },
  { documento: "LEI_CREDITOS", exercicio: 2024, rotulo: "Lei mais créditos 2024" },
  { documento: "PLOA", exercicio: 2025, rotulo: "PLOA 2025" },
  { documento: "LOA", exercicio: 2025, rotulo: "LOA 2025" },
  { documento: "EMPENHADO", exercicio: 2025, rotulo: "Empenhado 2025" },
  { documento: "LEI_CREDITOS", exercicio: 2025, rotulo: "Lei mais créditos 2025" },
  { documento: "PLOA", exercicio: 2026, rotulo: "PLOA 2026" },
  { documento: "LOA", exercicio: 2026, rotulo: "LOA 2026" },
  { documento: "PLOA", exercicio: 2027, rotulo: "PLOA 2027" },
] as const;

/** As ações que formam o dinheiro de funcionamento e de assistência dos câmpus: as da matriz. As demais são pessoal, benefícios e encargos. */
const ACOES_DA_MATRIZ = ["20RL", "2994", "21IV", "21IH", "21B3", "20RG"];

const RESULTADO_PRIMARIO: Record<number, string> = {
  0: "financeiro",
  1: "obrigatória",
  2: "discricionária",
  6: "emenda individual",
  7: "emenda de bancada",
  8: "emenda de comissão",
};

const COLUNAS_ACOES = [
  { documento: "PLOA", exercicio: 2026, rotulo: "PLOA 2026" },
  { documento: "LOA", exercicio: 2026, rotulo: "LOA 2026" },
  { documento: "PLOA", exercicio: 2027, rotulo: "PLOA 2027" },
] as const;

function Variacao({ de, para }: { de: number | undefined; para: number | undefined }) {
  if (de === undefined || para === undefined || de === 0) return <span className="text-xs text-neutral-400">-</span>;
  const d = para - de;
  const p = (d / de) * 100;
  const classe = Math.abs(d) < 1 ? "text-neutral-500" : d > 0 ? "text-if-green" : "text-if-red dark:text-red-400";
  return (
    <span className={classe}>
      {d >= 0 ? "+" : "-"}
      {reais.format(Math.abs(d))}
      <span className="block text-xs">
        {d >= 0 ? "+" : ""}
        {p.toFixed(1).replace(".", ",")}%
      </span>
    </span>
  );
}

export default async function OrcamentoDaUniaoPage() {
  await requireAcessoPlenoOrRedirect("/orcamento-da-uniao");

  const instituicao = await prisma.instituicao.findUnique({ where: { sigla: "IFSUL" } });
  const [totais, linhas, emendas] = instituicao
    ? await Promise.all([
        prisma.orcamentoLoaTotal.findMany({ where: { instituicaoId: instituicao.id } }),
        prisma.orcamentoLoaLinha.findMany({ where: { instituicaoId: instituicao.id } }),
        prisma.emendaParlamentar.findMany({ where: { instituicaoId: instituicao.id }, orderBy: [{ exercicio: "asc" }, { numeroEmenda: "asc" }] }),
      ])
    : [[], [], []];

  if (totais.length === 0) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-4 px-6 py-12 lg:px-12`}>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Orçamento da União do IFSul</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Ainda não foi carregado. Rode <code>npm run carregar:orcamento-loa</code>.
        </p>
      </main>
    );
  }

  const totalPor = new Map(totais.map((t) => [`${t.documento}:${t.exercicio}`, t]));

  // Valor por ação e documento (soma dos créditos) e a parte que é emenda (resultado primário 6, 7 ou 8) no documento.
  const chaveAcao = (documento: string, exercicio: number) => `${documento}:${exercicio}`;
  const porAcao = new Map<string, { descricao: string; valores: Map<string, number>; emenda: Map<string, number>; meta: Map<string, number>; produto: string | null }>();
  for (const l of linhas) {
    const a = porAcao.get(l.acao) ?? { descricao: l.acaoDescricao, valores: new Map(), emenda: new Map(), meta: new Map(), produto: null };
    const k = chaveAcao(l.documento, l.exercicio);
    a.valores.set(k, (a.valores.get(k) ?? 0) + Number(l.valor));
    if ([6, 7, 8].includes(l.resultadoPrimario)) a.emenda.set(k, (a.emenda.get(k) ?? 0) + Number(l.valor));
    if (l.meta !== null) a.meta.set(k, l.meta);
    if (l.produto) a.produto = l.produto;
    porAcao.set(l.acao, a);
  }
  const acoesOrdenadas = [...porAcao.entries()].sort((a, b) => {
    const ia = ACOES_DA_MATRIZ.indexOf(a[0]);
    const ib = ACOES_DA_MATRIZ.indexOf(b[0]);
    if (ia >= 0 || ib >= 0) return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
    return (b[1].valores.get("LOA:2026") ?? 0) - (a[1].valores.get("LOA:2026") ?? 0);
  });

  // Emendas por ação e exercício, do relatório do SIOP: o que foi aprovado, indicado ao IFSul e impedido.
  const emendasPorAcao = new Map<string, { exercicio: number; acao: string; descricao: string; aprovado: number; indicado: number; impedido: number; fonte: string }>();
  for (const e of emendas) {
    const k = `${e.exercicio}:${e.acao}`;
    const a = emendasPorAcao.get(k) ?? { exercicio: e.exercicio, acao: e.acao, descricao: e.acaoDescricao, aprovado: 0, indicado: 0, impedido: 0, fonte: e.fonte };
    a.aprovado += Number(e.valorAprovado);
    a.indicado += Number(e.valorIndicado);
    a.impedido += Number(e.valorImpedido);
    emendasPorAcao.set(k, a);
  }

  // O valor da instituição pela matriz (5ª fase, já com o Piso Mínimo) e o de cada ação de funcionamento na LOA, para somar as emendas.
  const [funcionamento2026, funcionamento2027] = instituicao
    ? await Promise.all(
        [2026, 2027].map((ano) =>
          prisma.distribuicaoCampus.aggregate({ where: { ano, unidade: { instituicaoId: instituicao.id } }, _sum: { vlMatrFinal: true } }),
        ),
      )
    : [null, null];
  const matriz = [
    { ano: 2026, valor: Number(funcionamento2026?._sum.vlMatrFinal ?? 0) },
    { ano: 2027, valor: Number(funcionamento2027?._sum.vlMatrFinal ?? 0) },
  ];
  const emendaNa20RL2026 = porAcao.get("20RL")?.emenda.get("LOA:2026") ?? 0;
  const emendaNa20RG2026 = porAcao.get("20RG")?.emenda.get("LOA:2026") ?? 0;
  const loa20RL2026 = porAcao.get("20RL")?.valores.get("LOA:2026") ?? 0;

  const fonteDe = (documento: string, exercicio: number) => totalPor.get(`${documento}:${exercicio}`)?.fonte ?? "";

  // Execução de 2026 (Portal da Transparência): orçamento por ação e execução por UG, para a comparação com o valor da matriz de cada câmpus.
  const ANO_EXECUCAO = 2026;
  const [orcamentoDespesa, execucoes, distribuicoes2026, unidades] = instituicao
    ? await Promise.all([
        prisma.orcamentoDespesaAcao.findMany({ where: { instituicaoId: instituicao.id, exercicio: ANO_EXECUCAO } }),
        prisma.execucaoDespesaUg.findMany({ where: { instituicaoId: instituicao.id, ano: ANO_EXECUCAO } }),
        prisma.distribuicaoCampus.findMany({ where: { ano: ANO_EXECUCAO, unidade: { instituicaoId: instituicao.id } } }),
        prisma.unidade.findMany({ where: { instituicaoId: instituicao.id } }),
      ])
    : [[], [], [], []];
  const mesesCarregados = [...new Set(execucoes.map((e) => e.mes))].sort((a, b) => a - b);
  const ultimoMes = mesesCarregados[mesesCarregados.length - 1];
  const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const orcamentoOrdenado = [...orcamentoDespesa].sort((a, b) => {
    const ia = ACOES_DA_MATRIZ.indexOf(a.acao);
    const ib = ACOES_DA_MATRIZ.indexOf(b.acao);
    if (ia >= 0 || ib >= 0) return (ia >= 0 ? ia : 99) - (ib >= 0 ? ib : 99);
    return Number(b.atualizado) - Number(a.atualizado);
  });

  // Por câmpus: o que a matriz atribuiu em 2026 (Funcionamento e Assistência) contra o que a UG do câmpus empenhou e pagou nas ações 20RL e 2994.
  const nomeDaUnidade = new Map(unidades.map((u) => [u.id, u.nome]));
  const matrizPorUnidade = new Map(
    distribuicoes2026.map((d) => [d.unidadeId, { funcionamento: Number(d.vlMatrFinal ?? 0), assistencia: Number(d.aePresencial ?? 0) + Number(d.aeEad ?? 0) + Number(d.aeRip ?? 0) }]),
  );
  type LinhaUg = { chave: string; nome: string; funcionamento: number; assistencia: number; emp20RL: number; pago20RL: number; emp2994: number; pago2994: number };
  const porUg = new Map<string, LinhaUg>();
  for (const e of execucoes) {
    const m = e.unidadeId !== null ? matrizPorUnidade.get(e.unidadeId) : undefined;
    const l = porUg.get(e.ugCodigo) ?? {
      chave: e.ugCodigo,
      nome: e.unidadeId !== null ? (nomeDaUnidade.get(e.unidadeId) ?? e.ugNome) : e.ugNome,
      funcionamento: m?.funcionamento ?? 0,
      assistencia: m?.assistencia ?? 0,
      emp20RL: 0,
      pago20RL: 0,
      emp2994: 0,
      pago2994: 0,
    };
    if (e.acao === "20RL") {
      l.emp20RL += Number(e.empenhado);
      l.pago20RL += Number(e.pago);
    } else if (e.acao === "2994") {
      l.emp2994 += Number(e.empenhado);
      l.pago2994 += Number(e.pago);
    }
    porUg.set(e.ugCodigo, l);
  }
  const linhasCampus = [...porUg.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const reitoria = linhasCampus.filter((l) => l.nome === "REITORIA");
  const campi = linhasCampus.filter((l) => l.nome !== "REITORIA");
  const somaCampi = campi.reduce(
    (s, l) => ({ funcionamento: s.funcionamento + l.funcionamento, assistencia: s.assistencia + l.assistencia, emp20RL: s.emp20RL + l.emp20RL, pago20RL: s.pago20RL + l.pago20RL, emp2994: s.emp2994 + l.emp2994, pago2994: s.pago2994 + l.pago2994 }),
    { funcionamento: 0, assistencia: 0, emp20RL: 0, pago20RL: 0, emp2994: 0, pago2994: 0 },
  );
  const porcento = (parte: number, todo: number) => (todo > 0 ? `${((parte / todo) * 100).toFixed(0)}%` : "-");
  const ehVenancio = (nome: string) => nome.includes("VENÂNCIO AIRES");
  const fonteExecucao = execucoes[0]?.fonte.replace(/, [0-9]{6}_Despesas\.csv$/, ", arquivos mensais AAAAMM_Despesas.csv") ?? "";

  const textoParaOChat = [
    "Orçamento da União do IFSul.",
    ...COLUNAS_TOTAIS.map((c) => {
      const t = totalPor.get(`${c.documento}:${c.exercicio}`);
      return t ? `${c.rotulo}: ${reais.format(Number(t.valor))}.` : "";
    }).filter(Boolean),
    ...orcamentoOrdenado
      .filter((o) => ACOES_DA_MATRIZ.includes(o.acao))
      .map((o) => `Execução ${ANO_EXECUCAO}, ação ${o.acao}: inicial ${reais.format(Number(o.inicial))}, atualizado ${reais.format(Number(o.atualizado))}, empenhado ${reais.format(Number(o.empenhado))}, realizado ${reais.format(Number(o.realizado))}.`),
    ...campi
      .filter((l) => ehVenancio(l.nome))
      .map((l) => `${l.nome}: matriz de funcionamento ${reais.format(l.funcionamento)}, 20RL empenhado ${reais.format(l.emp20RL)} e pago ${reais.format(l.pago20RL)}; assistência na matriz ${reais.format(l.assistencia)}, 2994 empenhado ${reais.format(l.emp2994)} e pago ${reais.format(l.pago2994)}.`),
    `Soma dos câmpus: matriz de funcionamento ${reais.format(somaCampi.funcionamento)}, 20RL pago ${reais.format(somaCampi.pago20RL)}.`,
  ].join("\n");

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-8 px-6 py-12 lg:px-12`}>
      <ContextoDaTela texto={textoParaOChat} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Orçamento da União do IFSul (LOA, PLOA e emendas)</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A matriz distribui um valor que o Congresso já aprovou na Lei Orçamentária Anual (LOA). Aqui está esse valor para o IFSul, ação por ação, como o
          governo o propôs (PLOA) e como o Congresso o aprovou (LOA), mais as emendas parlamentares. A fonte de cada número aparece junto dele.
        </p>
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <strong>A LOA e o PLOA vão só até a instituição e o estado</strong> (o localizador de cada ação é "No Estado do Rio Grande do Sul"). Não existe valor por
          câmpus nesses documentos: não dá para confirmar por eles, por exemplo, se os R$ 700 mil de um câmpus novo foram pagos. O valor por câmpus fica em{" "}
          <Link href="/admin/valores-recebidos" className={PROSE_LINK}>
            Valores recebidos
          </Link>
          , que é digitado.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Total do IFSul por documento e exercício</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Todas as ações e todas as fontes de recurso. O PLOA é a proposta do governo (agosto do ano anterior); a LOA é a lei aprovada; "Lei mais créditos" é a
          LOA com os créditos abertos durante o ano; "Empenhado" é o que foi de fato comprometido.
        </p>
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                {COLUNAS_TOTAIS.map((c) => (
                  <th key={c.rotulo} className="px-3 py-2 text-right" title={fonteDe(c.documento, c.exercicio)}>
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {COLUNAS_TOTAIS.map((c) => {
                  const t = totalPor.get(`${c.documento}:${c.exercicio}`);
                  return (
                    <td key={c.rotulo} className="px-3 py-3 text-right font-medium tabular-nums">
                      {t ? reais.format(Number(t.valor)) : "-"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          Fontes: PLOA 2026, Volume V; LOA 2026 (Lei nº 15.346/2026), Volume V; PLOA 2027 (versão de 28/08/2026), Volume V; todos no Quadro Síntese da unidade
          26436, Instituto Federal Sul-rio-grandense. Passe o mouse sobre o título de cada coluna para ver a fonte exata.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Por ação orçamentária</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          As seis primeiras linhas são as ações que pagam o funcionamento e a assistência dos câmpus, que é o que a matriz distribui. As demais são pessoal,
          benefícios e encargos. "Emenda na LOA" é a parte do valor da ação que veio de emenda parlamentar (resultado primário 6, emenda individual).
        </p>
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2">Ação</th>
                {COLUNAS_ACOES.map((c) => (
                  <th key={c.rotulo} className="px-3 py-2 text-right">
                    {c.rotulo}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Variação PLOA 2027 sobre LOA 2026</th>
                <th className="px-3 py-2 text-right">Emenda na LOA 2026</th>
                <th className="px-3 py-2 text-right">Meta (LOA 2026 / PLOA 2027)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {acoesOrdenadas.map(([codigo, a]) => {
                const daMatriz = ACOES_DA_MATRIZ.includes(codigo);
                const metaLoa = a.meta.get("LOA:2026");
                const metaPloa = a.meta.get("PLOA:2027");
                return (
                  <tr key={codigo} className={daMatriz ? "bg-if-green/5" : ""}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-neutral-500">{codigo}</span> {a.descricao}
                    </td>
                    {COLUNAS_ACOES.map((c) => {
                      const v = a.valores.get(chaveAcao(c.documento, c.exercicio));
                      return (
                        <td key={c.rotulo} className="px-3 py-2 text-right tabular-nums">
                          {v !== undefined ? reais.format(v) : <span className="text-xs text-neutral-400">sem crédito</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Variacao de={a.valores.get("LOA:2026")} para={a.valores.get("PLOA:2027")} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(a.emenda.get("LOA:2026") ?? 0) > 0 ? reais.format(a.emenda.get("LOA:2026")!) : <span className="text-xs text-neutral-400">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                      {metaLoa !== undefined || metaPloa !== undefined ? (
                        <>
                          {metaLoa !== undefined ? inteiro.format(metaLoa) : "-"} / {metaPloa !== undefined ? inteiro.format(metaPloa) : "-"}
                          {a.produto ? <span className="block">{a.produto.replace(" (unidade)", "")}</span> : null}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          Fontes: PLOA 2026, LOA 2026 e PLOA 2027, Volume V, Quadro dos Créditos Orçamentários da unidade 26436. No PLOA 2026 a ação 21IV (alimentação do
          estudante) estava incorporada à 2994; a LOA 2026 e o PLOA 2027 as trazem separadas, então compare 21IV e 2994 juntas.
        </p>
      </section>

      {orcamentoDespesa.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Execução {ANO_EXECUCAO} por ação</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Do orçamento aprovado ao dinheiro gasto, ação por ação, com a posição do Portal da Transparência
            {ultimoMes ? ` até o fim de ${NOMES_MES[ultimoMes - 1]} de ${ANO_EXECUCAO}` : ""}. "Inicial" é a LOA; "atualizado" é a LOA mais os créditos abertos durante o ano;
            "empenhado" é o que o IFSul já comprometeu; "realizado" é o que o Portal chama de orçamento realizado, que coincide com o valor pago.
          </p>
          <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Ação</th>
                  <th className="px-3 py-2 text-right">Inicial</th>
                  <th className="px-3 py-2 text-right">Atualizado</th>
                  <th className="px-3 py-2 text-right">Empenhado</th>
                  <th className="px-3 py-2 text-right">Realizado</th>
                  <th className="px-3 py-2 text-right">Realizado sobre atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {orcamentoOrdenado.map((o) => (
                  <tr key={o.acao} className={ACOES_DA_MATRIZ.includes(o.acao) ? "bg-if-green/5" : ""} title={o.fonte}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-neutral-500">{o.acao}</span> {o.acaoDescricao}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(Number(o.inicial))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(Number(o.atualizado))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(Number(o.empenhado))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(Number(o.realizado))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{porcento(Number(o.realizado), Number(o.atualizado))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Fonte: {orcamentoDespesa[0]!.fonte}. As linhas verdes são as ações da matriz. O empenhado desta tabela vem do orçamento por unidade orçamentária; a tabela por
            câmpus abaixo vem da execução por unidade gestora. Os dois recortes não são idênticos, e na ação 20RL o total por UG fica cerca de 2% acima.
          </p>
        </section>
      )}

      {campi.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Por câmpus: o valor da matriz e o que cada unidade gastou em {ANO_EXECUCAO}</h2>
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <strong>Não são grandezas iguais.</strong> O valor da matriz é uma referência de distribuição: diz quanto cabe a cada câmpus pela regra, não é um
            limite de gasto nem um repasse carimbado. A execução é o que a unidade gestora (UG) do câmpus de fato empenhou e pagou nas ações 20RL (funcionamento) e
            2994 (assistência), que também recebem emenda, crédito suplementar e descentralização, e cujo pagamento acompanha o calendário do ano, não o da matriz.
            Use a comparação para ver o ritmo e a ordem de grandeza, não para dizer que um câmpus "gastou a mais" ou "a menos".
          </p>
          <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2" rowSpan={2}>
                    Câmpus (UG)
                  </th>
                  <th className="border-l border-neutral-200 px-3 py-2 text-center dark:border-neutral-800" colSpan={4}>
                    Funcionamento (ação 20RL)
                  </th>
                  <th className="border-l border-neutral-200 px-3 py-2 text-center dark:border-neutral-800" colSpan={4}>
                    Assistência estudantil (ação 2994)
                  </th>
                </tr>
                <tr>
                  <th className="border-l border-neutral-200 px-3 py-2 text-right dark:border-neutral-800">Matriz</th>
                  <th className="px-3 py-2 text-right">Empenhado</th>
                  <th className="px-3 py-2 text-right">Pago</th>
                  <th className="px-3 py-2 text-right">Pago / matriz</th>
                  <th className="border-l border-neutral-200 px-3 py-2 text-right dark:border-neutral-800">Matriz</th>
                  <th className="px-3 py-2 text-right">Empenhado</th>
                  <th className="px-3 py-2 text-right">Pago</th>
                  <th className="px-3 py-2 text-right">Pago / matriz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {campi.map((l) => (
                  <tr key={l.chave} className={ehVenancio(l.nome) ? "bg-if-green/10 font-medium" : ""}>
                    <td className="px-3 py-2">
                      {l.nome}
                      {ehVenancio(l.nome) ? <span className="ml-2 rounded bg-if-green px-1.5 py-0.5 text-xs font-normal text-white">destaque</span> : null}
                      <span className="block font-mono text-xs font-normal text-neutral-500">UG {l.chave}</span>
                    </td>
                    <td className="border-l border-neutral-200 px-3 py-2 text-right tabular-nums dark:border-neutral-800">{l.funcionamento > 0 ? reais.format(l.funcionamento) : "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.emp20RL)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.pago20RL)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{porcento(l.pago20RL, l.funcionamento)}</td>
                    <td className="border-l border-neutral-200 px-3 py-2 text-right tabular-nums dark:border-neutral-800">{l.assistencia > 0 ? reais.format(l.assistencia) : "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.emp2994)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.pago2994)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{porcento(l.pago2994, l.assistencia)}</td>
                  </tr>
                ))}
                <tr className="bg-neutral-50 font-semibold dark:bg-neutral-900">
                  <td className="px-3 py-2">Soma dos câmpus</td>
                  <td className="border-l border-neutral-200 px-3 py-2 text-right tabular-nums dark:border-neutral-800">{reais.format(somaCampi.funcionamento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(somaCampi.emp20RL)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(somaCampi.pago20RL)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{porcento(somaCampi.pago20RL, somaCampi.funcionamento)}</td>
                  <td className="border-l border-neutral-200 px-3 py-2 text-right tabular-nums dark:border-neutral-800">{reais.format(somaCampi.assistencia)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(somaCampi.emp2994)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(somaCampi.pago2994)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{porcento(somaCampi.pago2994, somaCampi.assistencia)}</td>
                </tr>
                {reitoria.map((l) => (
                  <tr key={l.chave}>
                    <td className="px-3 py-2">
                      Reitoria
                      <span className="block font-mono text-xs text-neutral-500">UG {l.chave}</span>
                    </td>
                    <td className="border-l border-neutral-200 px-3 py-2 text-right text-xs text-neutral-500 dark:border-neutral-800">sem valor por câmpus</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.emp20RL)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.pago20RL)}</td>
                    <td className="px-3 py-2 text-right text-neutral-400">-</td>
                    <td className="border-l border-neutral-200 px-3 py-2 text-right text-xs text-neutral-500 dark:border-neutral-800">sem valor por câmpus</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.emp2994)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.pago2994)}</td>
                    <td className="px-3 py-2 text-right text-neutral-400">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Fontes: valor da matriz em MDO, 5ª fase, ciclo {ANO_EXECUCAO} (Funcionamento final do câmpus, já com o Piso Mínimo; Assistência = presencial, EAD e
            Regime de Internato Pleno); execução em {fonteExecucao}, UG a UG, somando os planos orçamentários, sem restos a pagar. A Reitoria concentra despesa
            central (contratos e serviços de toda a instituição) e o bloco Reitorias da matriz, que não é aberto por câmpus; por isso fica fora da soma.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Emendas parlamentares individuais por ação e exercício</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Do relatório do SIOP (Sistema Integrado de Planejamento e Orçamento): o que o parlamentar aprovou para a ação, o que indicou ao IFSul e o que foi
          impedido (inviabilizado) antes do pagamento. Só emendas individuais, com posição de 20/05/2026.
        </p>
        {emendasPorAcao.size === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma emenda individual do IFSul no relatório carregado.</p>
        ) : (
          <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Exercício</th>
                  <th className="px-3 py-2">Ação</th>
                  <th className="px-3 py-2 text-right">Aprovado pelo parlamentar</th>
                  <th className="px-3 py-2 text-right">Indicado ao IFSul</th>
                  <th className="px-3 py-2 text-right">Impedido</th>
                  <th className="px-3 py-2">Fonte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {[...emendasPorAcao.values()].map((a) => (
                  <tr key={`${a.exercicio}:${a.acao}`}>
                    <td className="px-3 py-2 tabular-nums">{a.exercicio}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-neutral-500">{a.acao}</span> {a.descricao}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(a.aprovado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{reais.format(a.indicado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-if-red dark:text-red-400">{a.impedido > 0 ? reais.format(a.impedido) : "-"}</td>
                    <td className="max-w-md px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">{a.fonte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {emendas.length > 0 && (
          <details className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <summary className="cursor-pointer font-medium text-neutral-800 dark:text-neutral-200">Cada emenda, com autor e justificativa de impedimento</summary>
            <div className="tabela-rolavel mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-neutral-500">
                  <tr>
                    <th className="px-2 py-1">Autor</th>
                    <th className="px-2 py-1">Emenda</th>
                    <th className="px-2 py-1">Ação</th>
                    <th className="px-2 py-1">Beneficiário</th>
                    <th className="px-2 py-1 text-right">Aprovado</th>
                    <th className="px-2 py-1 text-right">Indicado</th>
                    <th className="px-2 py-1 text-right">Impedido</th>
                    <th className="px-2 py-1">Impedimento</th>
                  </tr>
                </thead>
                <tbody>
                  {emendas.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="px-2 py-1">{e.autor}</td>
                      <td className="px-2 py-1 tabular-nums">{e.numeroEmenda}</td>
                      <td className="px-2 py-1">{e.acao}</td>
                      <td className="px-2 py-1">{e.beneficiario.replace(/^\d+ - /, "")}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{reais.format(Number(e.valorAprovado))}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{reais.format(Number(e.valorIndicado))}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{reais.format(Number(e.valorImpedido))}</td>
                      <td className="px-2 py-1">
                        {e.tipoImpedimento}
                        {e.justificativa && e.justificativa !== e.tipoImpedimento ? <span className="block text-neutral-500">{e.justificativa}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Emendas somadas ao valor da instituição</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          O valor da matriz do IFSul (soma dos câmpus na 5ª fase, já com o Piso Mínimo) é o que a regra distribui. As emendas entram na mesma ação de funcionamento
          (20RL) e na de reestruturação (20RG) por fora da matriz. Somadas, mostram quanto o IFSul tem para funcionamento em 2026.
        </p>
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2">Parcela (2026)</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              <tr>
                <td className="px-3 py-2">Valor da matriz (funcionamento, soma dos câmpus)</td>
                <td className="px-3 py-2 text-right tabular-nums">{reais.format(matriz[0]!.valor)}</td>
                <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">MDO, 5ª fase (Completo proposta), ciclo 2026</td>
              </tr>
              <tr>
                <td className="px-3 py-2">+ Emenda individual na ação 20RL (funcionamento)</td>
                <td className="px-3 py-2 text-right tabular-nums">{reais.format(emendaNa20RL2026)}</td>
                <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">LOA 2026, resultado primário 6 (emenda individual), ação 20RL</td>
              </tr>
              <tr>
                <td className="px-3 py-2">+ Emenda individual na ação 20RG (reestruturação)</td>
                <td className="px-3 py-2 text-right tabular-nums">{reais.format(emendaNa20RG2026)}</td>
                <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">LOA 2026, resultado primário 6 (emenda individual), ação 20RG</td>
              </tr>
              <tr className="bg-neutral-50 font-semibold dark:bg-neutral-900">
                <td className="px-3 py-2">= Matriz mais emendas</td>
                <td className="px-3 py-2 text-right tabular-nums">{reais.format(matriz[0]!.valor + emendaNa20RL2026 + emendaNa20RG2026)}</td>
                <td className="px-3 py-2 text-xs font-normal text-neutral-600 dark:text-neutral-400">Soma das três parcelas acima</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Ação 20RL inteira na LOA 2026, para comparar</td>
                <td className="px-3 py-2 text-right tabular-nums">{reais.format(loa20RL2026)}</td>
                <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
                  LOA 2026, ação 20RL, todas as fontes e naturezas de despesa (inclui investimento, recursos próprios e outras parcelas fora da matriz)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          O valor da matriz de 2027 é {reais.format(matriz[1]!.valor)}; as emendas de 2027 só existirão depois da LOA 2027 e ainda não estão nos documentos. A
          emenda da ação 20RG não faz parte do funcionamento da matriz; está na tabela para mostrar o que o IFSul recebe além dela.
        </p>
      </section>

      <p className="text-xs text-neutral-500">
        Veja também a{" "}
        <Link href="/situacao-dos-dados" className={PROSE_LINK}>
          situação dos dados
        </Link>{" "}
        e os{" "}
        <Link href="/dados-importados" className={PROSE_LINK}>
          dados importados
        </Link>
        . Os valores do orçamento da União do IFSul foram lidos dos PDFs oficiais e conferidos: a soma dos créditos de cada documento fecha com o total do seu Quadro Síntese.
      </p>
    </main>
  );
}
