import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { PainelProcedencia } from "@/components/Procedencia";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
}

function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

export default async function EvasaoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const sigla = params.instituicao ?? "IFSUL";
  const campusId = params.campus ? Number(params.campus) : null;

  const [anos, instituicoes] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } }),
    prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }),
  ]);
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];

  if (!instituicao || anos.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Perda por evasão</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Esta tela depende da 6ª fase da MDO, que traz o valor por ciclo de curso. Nenhum ciclo carregado ainda.
        </p>
      </main>
    );
  }

  // Rede inteira, para situar a instituição.
  const rede = await prisma.distribuicaoCiclo.aggregate({
    where: { ano },
    _sum: { valorReais: true, perdaEvasaoReais: true },
  });
  const redeRecebido = Number(rede._sum.valorReais ?? 0);
  const redePerda = Number(rede._sum.perdaEvasaoReais ?? 0);
  const redePct = pct(redePerda, redeRecebido);

  // Todas as instituições, para o ranking (são só 42, cabe em memória).
  const porInstituicao = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano },
    _sum: { valorReais: true, perdaEvasaoReais: true },
  });
  const unidades = await prisma.unidade.findMany({
    select: { id: true, nome: true, instituicaoId: true },
  });
  const instPorUnidade = new Map(unidades.map((u) => [u.id, u.instituicaoId]));
  const nomePorUnidade = new Map(unidades.map((u) => [u.id, u.nome]));

  const acumuladoInst = new Map<number, { recebido: number; perda: number }>();
  for (const g of porInstituicao) {
    const instId = instPorUnidade.get(g.unidadeId);
    if (instId === undefined) continue;
    const a = acumuladoInst.get(instId) ?? { recebido: 0, perda: 0 };
    a.recebido += Number(g._sum.valorReais ?? 0);
    a.perda += Number(g._sum.perdaEvasaoReais ?? 0);
    acumuladoInst.set(instId, a);
  }
  const ranking = Array.from(acumuladoInst.entries())
    .map(([id, a]) => ({ id, ...a, taxa: pct(a.perda, a.recebido) }))
    .sort((x, y) => x.taxa - y.taxa);
  const posicao = ranking.findIndex((r) => r.id === instituicao.id) + 1;
  const daInstituicao = ranking.find((r) => r.id === instituicao.id) ?? { recebido: 0, perda: 0, taxa: 0 };

  // Câmpus da instituição.
  const campusLinhas = porInstituicao
    .filter((g) => instPorUnidade.get(g.unidadeId) === instituicao.id)
    .map((g) => {
      const recebido = Number(g._sum.valorReais ?? 0);
      const perda = Number(g._sum.perdaEvasaoReais ?? 0);
      return { unidadeId: g.unidadeId, nome: nomePorUnidade.get(g.unidadeId) ?? "?", recebido, perda, taxa: pct(perda, recebido) };
    })
    .sort((a, b) => b.perda - a.perda);

  // Cursos: do câmpus escolhido, ou de toda a instituição.
  const cursosBrutos = await prisma.distribuicaoCiclo.groupBy({
    by: ["curso", "nivel"],
    where: campusId
      ? { ano, unidadeId: campusId }
      : { ano, unidade: { instituicaoId: instituicao.id } },
    _sum: { valorReais: true, perdaEvasaoReais: true },
    _count: { _all: true },
  });
  const cursos = cursosBrutos
    .map((c) => {
      const recebido = Number(c._sum.valorReais ?? 0);
      const perda = Number(c._sum.perdaEvasaoReais ?? 0);
      return { curso: c.curso, nivel: c.nivel, ciclos: c._count._all, recebido, perda, taxa: pct(perda, recebido) };
    })
    .filter((c) => c.perda > 0)
    .sort((a, b) => b.perda - a.perda);

  const fonte = await prisma.fonteDados.findFirst({
    where: { cicloOrcamento: ano, fase: "F6_PARTICIPACAO" },
    orderBy: { carregadoEm: "desc" },
  });

  function href(mudanca: Partial<Busca>) {
    const q = new URLSearchParams({
      ano: String(ano),
      instituicao: sigla,
      ...(campusId ? { campus: String(campusId) } : {}),
      ...Object.fromEntries(Object.entries(mudanca).filter(([, v]) => v !== undefined)),
    } as Record<string, string>);
    return `/evasao?${q.toString()}`;
  }

  const nomeCampus = campusId ? nomePorUnidade.get(campusId) : null;
  const melhorQueRede = daInstituicao.taxa < redePct;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Perda por evasão</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          A MDO publica, para cada ciclo de curso, quanto se perdeu por evasão. É o dado mais acionável
          da matriz: ao contrário do orçamento total, que depende de decisão federal, esta parcela
          responde ao que a instituição faz com os alunos que já tem.
        </p>
        <p className="max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
          O valor vem pronto da coluna <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">Perda Evasão (R$)</code> da
          6ª fase. Este sistema não o recalcula, e a definição exata de como a MDO o apura é dela.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ciclo</span>
          <div className="flex gap-1">
            {anos.map((a) => (
              <Link
                key={a.ano}
                href={href({ ano: String(a.ano), campus: undefined })}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  a.ano === ano
                    ? "bg-if-green text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {a.ano}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          <SeletorInstituicao
            instituicoes={instituicoes}
            siglaEscolhida={sigla}
            urlPorSigla={Object.fromEntries(
              instituicoes.map((i) => [i.sigla, href({ instituicao: i.sigla, campus: undefined })]),
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Perda no ciclo" valor={reais.format(daInstituicao.perda)} destaque="text-if-red dark:text-red-400" />
        <Cartao rotulo="Sobre o recebido" valor={`${doisDecimais.format(daInstituicao.taxa)}%`} />
        <Cartao rotulo="Média da rede" valor={`${doisDecimais.format(redePct)}%`} />
        <Cartao
          rotulo="Posição na rede"
          valor={`${posicao}º de ${ranking.length}`}
          nota={melhorQueRede ? "quanto menor, melhor" : "acima da média da rede"}
        />
      </div>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          melhorQueRede
            ? "border-if-green/40 bg-if-green/5 text-neutral-700 dark:text-neutral-300"
            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        }`}
      >
        {melhorQueRede ? (
          <>
            O {instituicao.sigla} perde <strong>{doisDecimais.format(daInstituicao.taxa)}%</strong> do que recebe,
            contra <strong>{doisDecimais.format(redePct)}%</strong> da rede, e ocupa a{" "}
            <strong>{posicao}ª melhor posição entre {ranking.length} instituições</strong>. O ganho não está em
            uma virada geral, e sim nos bolsões internos abaixo: os câmpus e cursos que puxam a média para cima.
          </>
        ) : (
          <>
            O {instituicao.sigla} perde <strong>{doisDecimais.format(daInstituicao.taxa)}%</strong> do que recebe,
            acima dos <strong>{doisDecimais.format(redePct)}%</strong> da rede.
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Por câmpus</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <TabelaOrdenavel
            linhas={campusLinhas}
            chaveLinha={(c) => c.unidadeId}
            linhaClasse={(c) => (c.unidadeId === campusId ? "bg-if-green/5" : "")}
            colunas={
              [
                {
                  chave: "nome",
                  rotulo: "Câmpus",
                  valor: (c) => c.nome,
                  render: (c) => (
                    <Link href={href({ campus: String(c.unidadeId) })} className="hover:underline">
                      {c.nome}
                    </Link>
                  ),
                },
                {
                  chave: "recebido",
                  rotulo: "Recebido",
                  alinhamento: "right",
                  valor: (c) => c.recebido,
                  render: (c) => <span className="text-neutral-600 dark:text-neutral-400">{reais.format(c.recebido)}</span>,
                },
                {
                  chave: "perda",
                  rotulo: "Perda",
                  alinhamento: "right",
                  valor: (c) => c.perda,
                  render: (c) => <span className="font-medium text-if-red dark:text-red-400">{reais.format(c.perda)}</span>,
                },
                {
                  chave: "taxa",
                  rotulo: "Taxa",
                  alinhamento: "right",
                  valor: (c) => c.taxa,
                  render: (c) => `${doisDecimais.format(c.taxa)}%`,
                },
                {
                  chave: "barra",
                  rotulo: "Contra a rede",
                  ordenavel: false,
                  valor: () => null,
                  render: (c) => <Barra taxa={c.taxa} referencia={redePct} />,
                },
              ] satisfies ColunaOrdenavel<(typeof campusLinhas)[number]>[]
            }
            rodape={
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
                  <td className="px-4 py-2.5">{instituicao.sigla}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(daInstituicao.recebido)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
                    {reais.format(daInstituicao.perda)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{doisDecimais.format(daInstituicao.taxa)}%</td>
                  <td className="px-4 py-2.5" />
                </tr>
              </tfoot>
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Por curso {nomeCampus ? `, em ${nomeCampus}` : `, em todo o ${instituicao.sigla}`}
          </h2>
          {campusId && (
            <Link href={href({ campus: undefined })} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
              ver a instituição inteira
            </Link>
          )}
        </div>
        <p className="max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
          Ordenado pela perda em reais. A coluna <strong>Taxa</strong> mostra outra história: um curso pequeno
          pode perder pouco dinheiro e ainda assim estar perdendo quase tudo que recebe.
        </p>
        <div className="max-h-[36rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <TabelaOrdenavel
            linhas={cursos}
            chaveLinha={(c) => `${c.curso}-${c.nivel}-${cursos.indexOf(c)}`}
            cabecalhoFixo
            corpoVazio={
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Nenhum curso com perda registrada neste recorte.
                </td>
              </tr>
            }
            colunas={
              [
                { chave: "curso", rotulo: "Curso", valor: (c) => c.curso },
                { chave: "nivel", rotulo: "Nível", valor: (c) => c.nivel, render: (c) => c.nivel ?? "—" },
                {
                  chave: "ciclos",
                  rotulo: "Ciclos",
                  alinhamento: "right",
                  valor: (c) => c.ciclos,
                  render: (c) => <span className="text-neutral-600 dark:text-neutral-400">{inteiro.format(c.ciclos)}</span>,
                },
                {
                  chave: "recebido",
                  rotulo: "Recebido",
                  alinhamento: "right",
                  valor: (c) => c.recebido,
                  render: (c) => <span className="text-neutral-600 dark:text-neutral-400">{reais.format(c.recebido)}</span>,
                },
                {
                  chave: "perda",
                  rotulo: "Perda",
                  alinhamento: "right",
                  valor: (c) => c.perda,
                  render: (c) => <span className="font-medium text-if-red dark:text-red-400">{reais.format(c.perda)}</span>,
                },
                {
                  chave: "taxa",
                  rotulo: "Taxa",
                  alinhamento: "right",
                  valor: (c) => c.taxa,
                  render: (c) => (
                    <span className={c.taxa >= 15 ? "font-semibold text-if-red dark:text-red-400" : ""}>
                      {doisDecimais.format(c.taxa)}%
                    </span>
                  ),
                },
              ] satisfies ColunaOrdenavel<(typeof cursos)[number]>[]
            }
          />
        </div>
      </div>

      {fonte && <PainelProcedencia fonte={fonte} />}
    </main>
  );
}

function Cartao({ rotulo, valor, destaque, nota }: { rotulo: string; valor: string; destaque?: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${destaque ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {valor}
      </div>
      {nota && <div className="mt-0.5 text-xs text-neutral-500">{nota}</div>}
    </div>
  );
}

/** Barra que compara a taxa do câmpus com a média da rede, que é a marca vertical. */
function Barra({ taxa, referencia }: { taxa: number; referencia: number }) {
  const escala = Math.max(taxa, referencia) * 1.6 || 1;
  const largura = Math.min((taxa / escala) * 100, 100);
  const marca = Math.min((referencia / escala) * 100, 100);
  const acima = taxa > referencia;
  return (
    <div
      className="relative h-3 w-32 rounded-sm bg-neutral-100 dark:bg-neutral-800"
      title={`${doisDecimais.format(taxa)}% contra ${doisDecimais.format(referencia)}% da rede`}
    >
      <div
        className={`h-full rounded-sm ${acima ? "bg-if-red/70" : "bg-if-green/70"}`}
        style={{ width: `${largura}%` }}
      />
      <div
        className="absolute inset-y-0 w-px bg-neutral-500 dark:bg-neutral-400"
        style={{ left: `${marca}%` }}
        aria-hidden
      />
    </div>
  );
}
