import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { ComoLerEstaTela } from "@/components/ComoLerEstaTela";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";
import { PrestacaoDeContas, type LinhaExecutada } from "./PrestacaoDeContas";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function PrestacaoDeContasPage() {
  await requireAcessoPlenoOrRedirect("/emendas/prestacao-de-contas");
  const brutas = await prisma.emendaExecutada.findMany({
    where: { instituicao: { sigla: "IFSUL" } },
    include: { unidade: { select: { nome: true } } },
    orderBy: [{ ano: "asc" }, { codigoEmenda: "asc" }],
  });
  // As emendas apresentadas que o sistema conhece, para ligar a execução à proposta (mesmo exercício e mesmo número no espelho).
  const apresentadas = await prisma.emendaApresentada.findMany({ select: { exercicio: true, numero: true, ementa: true, partidoAutor: true, ufAutor: true } });
  const porNumero = new Map(apresentadas.map((a) => [`${a.exercicio}|${a.numero}`, a]));

  const linhas: LinhaExecutada[] = brutas.map((e) => {
    const a = porNumero.get(`${e.anoEmenda}|${e.numeroNoEspelho}`);
    return {
      ano: e.ano,
      codigo: e.codigoEmenda,
      anoEmenda: e.anoEmenda,
      autor: e.autor,
      partido: a?.partidoAutor ?? null,
      uf: a?.ufAutor ?? null,
      ementa: a?.ementa ?? null,
      campus: (e.unidade?.nome ?? e.ugNome).replace(/^CAMPUS( AVANÇADO)? /, ""),
      acao: e.acao,
      acaoNome: e.acaoNome,
      gnd: e.gnd,
      empenhado: Number(e.empenhado),
      liquidado: Number(e.liquidado),
      pago: Number(e.pago),
      rapPago: Number(e.rapPago),
    };
  });
  const anos = [...new Set(linhas.map((l) => l.ano))].sort();
  const total = linhas.reduce((s, l) => s + l.pago + l.rapPago, 0);

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <ContextoDaTela
        texto={`Prestação de contas das emendas parlamentares executadas pelo IFSul, por câmpus, de ${anos[0] ?? "-"} a ${anos[anos.length - 1] ?? "-"}, do Portal da Transparência. Total pago (no ano e em restos a pagar): ${reais.format(total)}.`}
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Emendas no IFSul: para onde foi cada uma</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A prestação de contas das emendas parlamentares que o IFSul executou{anos.length ? ` de ${anos[0]} a ${anos[anos.length - 1]}` : ""}: quem destinou, em qual câmpus o dinheiro foi
          gasto, em qual ação e quanto foi empenhado e pago. Veja também as{" "}
          <Link href="/emendas" className={PROSE_LINK}>
            emendas apresentadas ao orçamento do próximo ano
          </Link>
          .
        </p>
      </div>

      <ComoLerEstaTela>
        <p>
          <strong>De onde vem.</strong> Do arquivo mensal de despesas do Portal da Transparência (CGU). Cada linha diz a unidade gestora que gastou, que no IFSul é o câmpus ou a
          Reitoria, a ação, o grupo de despesa e, quando o dinheiro veio de emenda, o código e o autor dela. O arquivo existe desde 2014; antes disso, só se sabe a emenda da
          instituição inteira, pela lei orçamentária, e não o câmpus.
        </p>
        <p>
          <strong>O código da emenda</strong> tem 12 dígitos: o ano do orçamento, o número do autor e o número da emenda dele. Por exemplo, 202619860006 é a emenda 6 de 2026 do
          autor 1986. É o mesmo número do espelho de emendas do Congresso, por isso a tela liga a execução à proposta quando o sistema tem as duas.
        </p>
        <p>
          <strong>Empenhado, liquidado e pago.</strong> Empenhar é reservar o dinheiro para uma compra; liquidar é confirmar que o bem ou serviço foi entregue; pagar é o dinheiro
          sair. O que não é pago no ano vira restos a pagar e é pago nos anos seguintes: a coluna &quot;Restos pagos&quot; mostra isso, no ano em que foi pago. &quot;Total pago&quot; soma as duas.
        </p>
        <p>
          <strong>Como usar.</strong> Escolha o câmpus, o autor ou o período; os cartões e as tabelas mudam juntos. Nas abas, veja por ano, por câmpus, por autor ou cada emenda.
          O + abre logo abaixo as emendas daquela linha.
        </p>
      </ComoLerEstaTela>

      {linhas.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          Ainda não carregado. Rode <code>npm run carregar:emendas-executadas -- 2014 2026</code>.
        </p>
      ) : (
        <PrestacaoDeContas linhas={linhas} />
      )}

      <p className="text-xs text-neutral-500">
        Fonte: Portal da Transparência (CGU), Despesas, execução mensal (arquivos AAAAMM_Despesas), linhas das unidades gestoras do IFSul com código de emenda. Valores nominais, sem
        correção pela inflação.
      </p>
    </main>
  );
}
