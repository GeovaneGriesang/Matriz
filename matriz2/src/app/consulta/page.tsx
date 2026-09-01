import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { PainelProcedencia } from "@/components/Procedencia";

export const dynamic = "force-dynamic";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
}

export default async function ConsultaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const siglaEscolhida = params.instituicao ?? "IFSUL";
  const campusEscolhido = params.campus ? Number(params.campus) : null;

  const [anosDisponiveis, instituicoes] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } }),
    prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }),
  ]);

  const instituicao = instituicoes.find((i) => i.sigla === siglaEscolhida) ?? instituicoes[0];

  if (!instituicao) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Consulta</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Ainda não há dados carregados. Rode <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npm run carregar -- 2027</code>{" "}
          para trazer o ciclo 2027 das exportações da MDO.
        </p>
      </main>
    );
  }

  // Totais por câmpus da instituição escolhida.
  const porCampus = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano, unidade: { instituicaoId: instituicao.id } },
    _count: { _all: true },
    _sum: { valorReais: true, perdaEvasaoReais: true, matriculaTotal: true },
  });

  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampus.map((c) => c.unidadeId) } },
    select: { id: true, nome: true },
  });
  const nomePorId = new Map(unidades.map((u) => [u.id, u.nome]));

  const linhas = porCampus
    .map((c) => ({
      unidadeId: c.unidadeId,
      nome: nomePorId.get(c.unidadeId) ?? `Unidade ${c.unidadeId}`,
      ciclos: c._count._all,
      valor: Number(c._sum.valorReais ?? 0),
      perda: Number(c._sum.perdaEvasaoReais ?? 0),
      matricula: Number(c._sum.matriculaTotal ?? 0),
    }))
    .sort((a, b) => b.valor - a.valor);

  const total = linhas.reduce(
    (acc, l) => ({
      ciclos: acc.ciclos + l.ciclos,
      valor: acc.valor + l.valor,
      perda: acc.perda + l.perda,
      matricula: acc.matricula + l.matricula,
    }),
    { ciclos: 0, valor: 0, perda: 0, matricula: 0 },
  );

  // Rede inteira, para situar a participação da instituição.
  const rede = await prisma.distribuicaoCiclo.aggregate({ where: { ano }, _sum: { valorReais: true } });
  const totalRede = Number(rede._sum.valorReais ?? 0);

  // Detalhe por ciclo de curso, quando um câmpus está selecionado.
  const cursos = campusEscolhido
    ? await prisma.distribuicaoCiclo.findMany({
        where: { ano, unidadeId: campusEscolhido },
        orderBy: { valorReais: "desc" },
        select: {
          id: true, curso: true, nivel: true, tipoCurso: true, turno: true, repasse: true,
          matriculaTotal: true, valorReais: true, perdaEvasaoReais: true, pesoCursoMatriz: true,
        },
      })
    : [];

  const fonte = await prisma.fonteDados.findFirst({
    where: { cicloOrcamento: ano, fase: "F6_PARTICIPACAO" },
    orderBy: { carregadoEm: "desc" },
  });

  function href(mudanca: Partial<Busca>) {
    const q = new URLSearchParams({
      ano: String(ano),
      instituicao: siglaEscolhida,
      ...(campusEscolhido ? { campus: String(campusEscolhido) } : {}),
      ...Object.fromEntries(Object.entries(mudanca).filter(([, v]) => v !== undefined)),
    } as Record<string, string>);
    return `/consulta?${q.toString()}`;
  }

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Consulta</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          Quanto cada câmpus recebe da Matriz de Distribuição Orçamentária, e de quais cursos esse
          valor vem. Os números não são calculados aqui; vêm da 6ª fase da MDO, já homologada,
          detalhados curso a curso.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ciclo</span>
          <div className="flex gap-1">
            {anosDisponiveis.map((a) => (
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
          <form>
            <input type="hidden" name="ano" value={ano} />
            <select
              name="instituicao"
              defaultValue={siglaEscolhida}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {instituicoes.map((i) => (
                <option key={i.id} value={i.sigla}>
                  {i.sigla} — {i.nome}
                </option>
              ))}
            </select>
            <button type="submit" className="sr-only">
              Aplicar
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Recebido no ciclo" valor={reais.format(total.valor)} />
        <Cartao
          rotulo="Participação na rede"
          valor={totalRede > 0 ? `${decimal.format((total.valor / totalRede) * 100)}%` : "—"}
        />
        <Cartao rotulo="Matrícula total" valor={numero.format(total.matricula)} />
        <Cartao
          rotulo="Perda por evasão"
          valor={reais.format(total.perda)}
          destaque="text-if-red dark:text-red-400"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400">Câmpus</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Ciclos</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Matrícula</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Recebido</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Perda por evasão</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.unidadeId}
                className={`border-t border-neutral-200 dark:border-neutral-800 ${
                  l.unidadeId === campusEscolhido ? "bg-if-green/5" : ""
                }`}
              >
                <td className="px-4 py-2.5">
                  <Link href={href({ campus: String(l.unidadeId) })} className="hover:underline">
                    {l.nome}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {numero.format(l.ciclos)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {numero.format(l.matricula)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{reais.format(l.valor)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
                  {reais.format(l.perda)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
              <td className="px-4 py-2.5">{instituicao.sigla}, {linhas.length} câmpus</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{numero.format(total.ciclos)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{numero.format(total.matricula)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(total.valor)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
                {reais.format(total.perda)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {campusEscolhido && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {nomePorId.get(campusEscolhido)}, por ciclo de curso
            </h2>
            <Link href={href({ campus: undefined })} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
              limpar seleção
            </Link>
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-400">Curso</th>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-400">Nível</th>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-400">Repasse</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Peso</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Matrícula</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Recebido</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Perda</th>
                </tr>
              </thead>
              <tbody>
                {cursos.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-4 py-2">{c.curso}</td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{c.nivel ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{c.repasse.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                      {c.pesoCursoMatriz ? decimal.format(Number(c.pesoCursoMatriz)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                      {decimal.format(Number(c.matriculaTotal))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{reais.format(Number(c.valorReais))}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-if-red dark:text-red-400">
                      {reais.format(Number(c.perdaEvasaoReais ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fonte && <PainelProcedencia fonte={fonte} />}
    </main>
  );
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${destaque ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {valor}
      </div>
    </div>
  );
}
