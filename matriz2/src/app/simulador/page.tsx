import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { SimuladorEvasao, type LinhaSimulavel } from "@/components/simulador/SimuladorEvasao";
import { SimuladorRap, type InstituicaoRap } from "@/components/simulador/SimuladorRap";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { calcularQualidadeEficienciaRede } from "@/server/queries/qualidadeEficienciaRede";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
}

export default async function SimuladorPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;

  const [anos, instituicoes] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "desc" } }),
    prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }),
  ]);

  if (anos.length === 0) {
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

  const porCampusRede = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano },
    _sum: { valorReais: true, perdaEvasaoReais: true },
  });
  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampusRede.map((c) => c.unidadeId) } },
    select: { id: true, nome: true, instituicaoId: true },
  });
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const instituicaoPorId = new Map(instituicoes.map((i) => [i.id, i]));

  const linhasCampus: LinhaSimulavel[] = porCampusRede.map((c) => {
    const unidade = unidadePorId.get(c.unidadeId);
    const instituicao = unidade ? instituicaoPorId.get(unidade.instituicaoId) : undefined;
    return {
      chave: `campus-${c.unidadeId}`,
      nome: unidade?.nome ?? `Unidade ${c.unidadeId}`,
      recebido: Number(c._sum.valorReais ?? 0),
      perda: Number(c._sum.perdaEvasaoReais ?? 0),
      grupo: instituicao?.sigla,
    };
  });

  const totalPorInstituicao = new Map<string, { recebido: number; perda: number }>();
  for (const c of linhasCampus) {
    if (!c.grupo) continue;
    const atual = totalPorInstituicao.get(c.grupo) ?? { recebido: 0, perda: 0 };
    atual.recebido += c.recebido;
    atual.perda += c.perda;
    totalPorInstituicao.set(c.grupo, atual);
  }

  const linhasPorInstituicao: LinhaSimulavel[] = [];
  for (const instituicao of instituicoes) {
    const total = totalPorInstituicao.get(instituicao.sigla);
    if (!total) continue;
    const campi = linhasCampus
      .filter((c) => c.grupo === instituicao.sigla)
      .sort((a, b) => b.perda - a.perda);
    linhasPorInstituicao.push(
      {
        chave: `instituicao-${instituicao.sigla}`,
        nome: `${instituicao.sigla}, toda a instituição`,
        recebido: total.recebido,
        perda: total.perda,
        grupo: instituicao.sigla,
      },
      ...campi,
    );
  }

  const totalRede: LinhaSimulavel = {
    chave: "rede",
    nome: "Rede inteira (todas as instituições)",
    recebido: redeRecebido,
    perda: redePerda,
  };

  // RAP é sempre indicador de instituição, nunca de câmpus isolado (ver
  // /como-funciona#qualidade-eficiencia), por isso o simulador de RAP escolhe uma
  // instituição, diferente do simulador de evasão acima, que desce a câmpus.
  const redeQE = await calcularQualidadeEficienciaRede(ano);
  const instituicoesRap: InstituicaoRap[] = redeQE.instituicoes.map((i) => ({
    sigla: i.sigla,
    nome: i.nome,
    rapPresencial: i.rapPresencial,
    restoRedeRapPonderado: redeQE.somaRapPonderadoRecalc - i.rapPonderadoRecalc,
    rapEqualizadoOficial: i.rapEqualizadoOficial,
    vlRapOficial: i.vlRapOficial,
  }));

  function href(mudanca: Partial<Busca>) {
    const q = new URLSearchParams({
      ano: String(ano),
      ...Object.fromEntries(Object.entries(mudanca).filter(([, v]) => v !== undefined)),
    } as Record<string, string>);
    return `/simulador?${q.toString()}`;
  }

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Simulador</h1>
        <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
          E se a evasão de um câmpus, de uma instituição ou de toda a rede caísse? Escolha abaixo e uma redução
          hipotética para ver quanto se deixaria de perder, a partir do que a 6ª fase já publica por ciclo de
          curso.
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
              <Link
                key={a.ano}
                href={href({ ano: String(a.ano) })}
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
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Perda por evasão</h2>
        <SimuladorEvasao linhas={[totalRede, ...linhasPorInstituicao]} redeTaxa={redeTaxa} />
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Qualidade e Eficiência, RAP
          </h2>
          <p className="max-w-3xl text-neutral-600 dark:text-neutral-400">
            E se a RAP (Relação Aluno-Professor Presencial, também chamada de RAPP) de uma instituição
            mudasse de faixa? Diferente da evasão, a RAP só existe por instituição, nunca por câmpus
            isolado.
          </p>
        </div>
        <SimuladorRap instituicoes={instituicoesRap} totalBlocoRap={redeQE.totalBlocoRap} ano={ano} />
      </div>
    </main>
  );
}
