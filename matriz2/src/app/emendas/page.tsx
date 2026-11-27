import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { ComoLerEstaTela } from "@/components/ComoLerEstaTela";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";
import { ehInstituicaoDestaque } from "@/lib/destaque";
import { EmendasPainel, type EmendaDoPainel } from "./EmendasPainel";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function EmendasPage({ searchParams }: { searchParams: Promise<{ exercicio?: string }> }) {
  await requireAcessoPlenoOrRedirect("/emendas");
  const sp = await searchParams;

  const exercicios = (await prisma.emendaApresentada.findMany({ distinct: ["exercicio"], select: { exercicio: true }, orderBy: { exercicio: "desc" } })).map((e) => e.exercicio);
  const exercicio = exercicios.includes(Number(sp.exercicio)) ? Number(sp.exercicio) : exercicios[0];

  if (exercicio === undefined) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-4 px-6 py-12 lg:px-12`}>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Emendas ao orçamento da Rede Federal</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Ainda não foram carregadas. Rode <code>npm run carregar:emendas -- 2027</code>.
        </p>
      </main>
    );
  }

  const linhas = await prisma.emendaApresentada.findMany({ where: { exercicio }, include: { instituicao: true }, orderBy: { valorTotal: "desc" } });
  const emendas: EmendaDoPainel[] = linhas.map((e) => ({
    numero: e.numero,
    modalidade: e.modalidade,
    tipoAutor: e.tipoAutor,
    autor: e.autor,
    partidoAutor: e.partidoAutor,
    ufAutor: e.ufAutor,
    ementa: e.ementa,
    uoCodigo: e.uoCodigo,
    uoNome: e.uoNome,
    sigla: e.instituicao?.sigla ?? null,
    instituicao: e.instituicao?.nome ?? null,
    uf: e.uf,
    funcional: e.funcional,
    acao: e.acao,
    acaoDescricao: e.acaoDescricao,
    subtitulo: e.subtitulo,
    gnd3: Number(e.valorGnd3),
    gnd4: Number(e.valorGnd4),
    outros: Number(e.valorOutros),
    total: Number(e.valorTotal),
    comRecibo: e.comRecibo,
    justificativa: e.justificativa,
  }));
  const fonte = linhas[0]?.fonte ?? "";

  const doIfsul = emendas.filter((e) => e.sigla && ehInstituicaoDestaque(e.sigla));
  const textoParaOChat = [
    `Emendas de despesa apresentadas ao PLOA ${exercicio} para a Rede Federal (proposta dos parlamentares, antes do parecer).`,
    `Diretas às instituições: ${emendas.filter((e) => e.uoCodigo !== "26101").length} emendas, ${reais.format(emendas.filter((e) => e.uoCodigo !== "26101").reduce((s, e) => s + e.total, 0))}.`,
    `Pelo MEC, sem instituição definida: ${emendas.filter((e) => e.uoCodigo === "26101").length} emendas, ${reais.format(emendas.filter((e) => e.uoCodigo === "26101").reduce((s, e) => s + e.total, 0))}.`,
    `IFSul: ${doIfsul.length} emendas, ${reais.format(doIfsul.reduce((s, e) => s + e.total, 0))}: ` +
      doIfsul.map((e) => `${e.autor} ${reais.format(e.total)} na ${e.acao}`).join("; ") +
      ".",
  ].join("\n");

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <ContextoDaTela texto={textoParaOChat} />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Emendas ao orçamento de {exercicio} na Rede Federal</h1>
        <p className="text-sm">
          <Link href="/emendas/prestacao-de-contas" className={PROSE_LINK}>
            Emendas no IFSul: para onde foi cada uma, por câmpus, desde 2017
          </Link>
        </p>
        <p className="text-neutral-600 dark:text-neutral-400">
          As emendas que deputados, senadores, bancadas e comissões apresentaram ao projeto de lei orçamentária de {exercicio} para os Institutos Federais, os
          CEFETs e o Colégio Pedro II, com o IFSul em destaque. São propostas: o valor que fica só se conhece na lei aprovada (LOA).
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">Orçamento de:</span>
          {exercicios.map((a) =>
            a === exercicio ? (
              <span key={a} className="rounded bg-if-green px-2 py-0.5 font-semibold text-white">
                {a}
              </span>
            ) : (
              <Link key={a} href={`/emendas?exercicio=${a}`} className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
                {a}
              </Link>
            ),
          )}
          <span className="text-xs text-neutral-500">
            {exercicios.length === 1 ? `Só ${exercicio} carregado. ` : ""}As emendas de {exercicio} foram apresentadas em {exercicio - 1} ao projeto de lei (PLOA {exercicio}), conforme o espelho oficial da
            Comissão Mista de Orçamento. As emendas dos anos anteriores, já pagas, estão na prestação de contas.
          </span>
        </div>
      </div>

      <ComoLerEstaTela>
        <p>
          <strong>O que é uma emenda.</strong> Depois que o governo manda o projeto de lei orçamentária (PLOA) ao Congresso, em agosto, cada parlamentar, cada
          bancada estadual e cada comissão pode propor acréscimos a ações do orçamento, tirando o dinheiro de uma reserva. Cada emenda diz a unidade que recebe (o
          Instituto Federal, pela sua unidade orçamentária), a ação (20RL funcionamento, 20RG reestruturação e modernização, 21B3 e outras), o grupo de despesa
          (GND 3, custeio; GND 4, investimento) e o valor.
        </p>
        <p>
          <strong>Diretas e pelo MEC.</strong> &quot;Diretas&quot; são as emendas que já nomeiam a instituição. &quot;Pelo MEC&quot; são as que vão ao Ministério da
          Educação (unidade 26101) nas ações da rede, 219U (funcionamento e modernização) e 15R4 (expansão e reestruturação), sem dizer ainda qual instituição
          recebe: o MEC reparte depois. Por isso elas não entram no total de nenhuma instituição.
        </p>
        <p>
          <strong>Recibo.</strong> A emenda individual só vale se o parlamentar entregou o recibo. &quot;Com recibo&quot; quer dizer que o número dela consta no recibo
          de entrega das emendas individuais. As de bancada e de comissão têm outro rito e ficam sem essa marca.
        </p>
        <p>
          <strong>Valores de R$ 1 ou R$ 10.</strong> Alguns parlamentares registram emendas com valor simbólico, para reservar o número e acertar o valor depois.
          Elas aparecem com a marca &quot;valor simbólico&quot; e somam o que valem, quase nada.
        </p>
        <p>
          <strong>Como usar.</strong> Os filtros valem para tudo ao mesmo tempo: cartões, gráficos e tabelas. Em &quot;Quem destinou&quot;, escolha deputados, senadores,
          bancadas ou comissões (um ou vários), o partido, a UF do parlamentar ou o próprio parlamentar; em &quot;Para onde vai&quot;, a instituição, a região, a UF ou a ação.
          Clique numa barra dos gráficos para filtrar por ela. Cada filtro ligado aparece como uma etiqueta, com um × para tirar. Nas tabelas, o + abre logo abaixo as
          emendas, e na lista de todas as emendas abre tudo o que o espelho oficial traz, com a justificativa.
        </p>
      </ComoLerEstaTela>

      <EmendasPainel emendas={emendas} exercicio={exercicio} />

      <p className="text-xs text-neutral-500">
        Veja também o{" "}
        <a href="https://sites.google.com/view/painel-emendas-2027-rfepct/full-page-embed" target="_blank" rel="noopener noreferrer" className={PROSE_LINK}>
          Painel de Emendas 2027 dos Institutos Federais
        </a>
        , da Pró-Reitoria de Planejamento do IFRN (link incluído em 26/11/2026).
      </p>

      <p className="text-xs text-neutral-500">
        Fonte: {fonte} Conferido: a soma dos acréscimos de cada emenda fecha com o total impresso nela. Veja também o{" "}
        <Link href="/orcamento-da-uniao" className={PROSE_LINK}>
          Orçamento da União do IFSul
        </Link>
        , com a LOA, o PLOA e a execução.
      </p>
    </main>
  );
}
