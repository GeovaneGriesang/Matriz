import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { SimuladorEvasao, type LinhaSimulavel } from "@/components/simulador/SimuladorEvasao";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
}

export default async function SimuladorPage({ searchParams }: { searchParams: Promise<Busca> }) {
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const sigla = params.instituicao ?? "IFSUL";

  const [anos, instituicoes] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } }),
    prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }),
  ]);
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];

  if (!instituicao || anos.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Simulador</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Esta tela depende da 6ª fase da MDO, que traz a perda por evasão por ciclo de curso. Nenhum ciclo
          carregado ainda.
        </p>
      </main>
    );
  }

  const rede = await prisma.distribuicaoCiclo.aggregate({
    where: { ano },
    _sum: { valorReais: true, perdaEvasaoReais: true },
  });
  const redeRecebido = Number(rede._sum.valorReais ?? 0);
  const redePerda = Number(rede._sum.perdaEvasaoReais ?? 0);
  const redeTaxa = redeRecebido > 0 ? (redePerda / redeRecebido) * 100 : 0;

  const porCampus = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano, unidade: { instituicaoId: instituicao.id } },
    _sum: { valorReais: true, perdaEvasaoReais: true },
  });
  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampus.map((c) => c.unidadeId) } },
    select: { id: true, nome: true },
  });
  const nomePorUnidade = new Map(unidades.map((u) => [u.id, u.nome]));

  const linhasCampus: LinhaSimulavel[] = porCampus
    .map((c) => ({
      chave: `campus-${c.unidadeId}`,
      nome: nomePorUnidade.get(c.unidadeId) ?? `Unidade ${c.unidadeId}`,
      recebido: Number(c._sum.valorReais ?? 0),
      perda: Number(c._sum.perdaEvasaoReais ?? 0),
    }))
    .sort((a, b) => b.perda - a.perda);

  const totalInstituicao: LinhaSimulavel = {
    chave: "instituicao",
    nome: `${instituicao.sigla}, toda a instituição`,
    recebido: linhasCampus.reduce((s, l) => s + l.recebido, 0),
    perda: linhasCampus.reduce((s, l) => s + l.perda, 0),
  };

  function href(mudanca: Partial<Busca>) {
    const q = new URLSearchParams({
      ano: String(ano),
      instituicao: sigla,
      ...Object.fromEntries(Object.entries(mudanca).filter(([, v]) => v !== undefined)),
    } as Record<string, string>);
    return `/simulador?${q.toString()}`;
  }

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Simulador</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          E se a evasão de um câmpus caísse? Escolha um câmpus e uma redução hipotética para ver quanto ele
          deixaria de perder, a partir do que a 6ª fase já publica por ciclo de curso.
        </p>
        <p className="max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>É uma estimativa, não um recálculo da metodologia da CONIF.</strong> A conta é simples: valor
          recuperado = perda atual × redução simulada. Serve para dimensionar o efeito, não para prever o
          valor exato que a MDO publicaria se a evasão realmente caísse.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ciclo</span>
          <div className="flex gap-1">
            {anos.map((a) => (
              <a
                key={a.ano}
                href={href({ ano: String(a.ano) })}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  a.ano === ano
                    ? "bg-if-green text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {a.ano}
              </a>
            ))}
          </div>
        </div>
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          <form>
            <input type="hidden" name="ano" value={ano} />
            <select
              name="instituicao"
              defaultValue={sigla}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {instituicoes.map((i) => (
                <option key={i.id} value={i.sigla}>
                  {i.sigla} — {i.nome}
                </option>
              ))}
            </select>
            <button type="submit" className="sr-only">Aplicar</button>
          </form>
        </div>
      </div>

      <SimuladorEvasao linhas={[totalInstituicao, ...linhasCampus]} redeTaxa={redeTaxa} />
    </main>
  );
}
