import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { SimuladorUnificado, type NoInstituicaoSimulavel } from "@/components/simulador/SimuladorUnificado";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { calcularQualidadeEficienciaRede } from "@/server/queries/qualidadeEficienciaRede";
import { campusEstaNoPiso, carregarTaxasFuncionamento } from "@/server/queries/funcionamentoCampus";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
}

export default async function SimuladorPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;

  // Ciclos disponíveis: união da 6ª fase (evasão) com a tabela de indicadores por
  // instituição (RAP), porque um ciclo pode ter só uma das duas (2026 só tem RAP,
  // ainda sem 6ª fase).
  const [anosCiclo, anosIndicadores, instituicoes] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ distinct: ["ano"], select: { ano: true } }),
    prisma.distribuicaoInstituicao.findMany({ distinct: ["ano"], select: { ano: true } }),
    prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }),
  ]);
  const anos = Array.from(new Set([...anosCiclo, ...anosIndicadores].map((a) => a.ano)))
    .sort((a, b) => b - a)
    .map((ano) => ({ ano }));

  if (anos.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Simulador</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Esta tela depende da 6ª fase da MDO (perda por evasão) ou da aba &quot;INDICADORES&quot;
          (RAP). Nenhum ciclo carregado ainda.
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

  // Câmpus já travados no Piso Mínimo: reduzir a evasão simulada não aumenta o que
  // eles recebem de verdade, porque o Funcionamento já está no piso, não no cálculo
  // por matrícula que a evasão afeta (ver `funcionamentoCampus.ts`).
  const taxasFuncionamento = await carregarTaxasFuncionamento(ano);
  const distribuicaoCampusRede = taxasFuncionamento
    ? await prisma.distribuicaoCampus.findMany({
        where: { ano, unidadeId: { in: porCampusRede.map((c) => c.unidadeId) } },
        select: { unidadeId: true, mtPresencial: true, mtEad: true, mtEadMooc: true, mtEadFp: true, elegivelPiso: true },
      })
    : [];
  const noPisoPorId = new Map(
    distribuicaoCampusRede.map((d) => [
      d.unidadeId,
      campusEstaNoPiso(taxasFuncionamento!, {
        mtPresencial: Number(d.mtPresencial ?? 0),
        mtEad: Number(d.mtEad ?? 0),
        mtEadMooc: Number(d.mtEadMooc ?? 0),
        mtEadFp: Number(d.mtEadFp ?? 0),
        elegivelPiso: d.elegivelPiso,
      }),
    ]),
  );

  // RAP e IAPL são sempre indicadores de instituição, nunca de câmpus isolado (ver
  // /como-funciona#qualidade-eficiencia): por isso a árvore abaixo pendura os dois na
  // instituição, e um câmpus só carrega evasão e crescimento de matrícula.
  const redeQE = await calcularQualidadeEficienciaRede(ano);
  const indicadoresPorSigla = new Map(
    redeQE.instituicoes.map((i) => [
      i.sigla,
      {
        rap: {
          rapPresencial: i.rapPresencial,
          restoRedeRapPonderado: redeQE.somaRapPonderadoRecalc - i.rapPonderadoRecalc,
        },
        iapl: {
          aplTecnico: i.aplTecnico,
          restoRedeTecnico: redeQE.somaIaplTecnicoRecalc - i.iaplTecnicoPonderadoRecalc,
          aplFormacaoProfessor: i.aplFormacaoProfessor,
          restoRedeFormacao: redeQE.somaIaplFormacaoRecalc - i.iaplFormacaoPonderadoRecalc,
          aplProeja: i.aplProeja,
          restoRedeProeja: redeQE.somaIaplProejaRecalc - i.iaplProejaPonderadoRecalc,
        },
      },
    ]),
  );

  // Monta a árvore instituição → câmpus com o que cada uma tem: evasão (soma dos
  // câmpus com 6ª fase), RAP e IAPL (se a instituição tem indicador neste ciclo).
  // União das duas fontes porque um ciclo pode ter só uma (2026 só tem RAP/IAPL).
  const campiPorSigla = new Map<string, NoInstituicaoSimulavel["campi"]>();
  for (const c of porCampusRede) {
    const unidade = unidadePorId.get(c.unidadeId);
    const instituicao = unidade ? instituicaoPorId.get(unidade.instituicaoId) : undefined;
    if (!instituicao) continue;
    const lista = campiPorSigla.get(instituicao.sigla) ?? [];
    lista.push({
      unidadeId: c.unidadeId,
      nome: unidade?.nome ?? `Unidade ${c.unidadeId}`,
      recebido: Number(c._sum.valorReais ?? 0),
      perda: Number(c._sum.perdaEvasaoReais ?? 0),
      estaNoPiso: noPisoPorId.get(c.unidadeId) ?? false,
    });
    campiPorSigla.set(instituicao.sigla, lista);
  }

  const siglasComDado = new Set([...campiPorSigla.keys(), ...indicadoresPorSigla.keys()]);
  const arvore: NoInstituicaoSimulavel[] = instituicoes
    .filter((i) => siglasComDado.has(i.sigla))
    .map((i) => {
      const campi = (campiPorSigla.get(i.sigla) ?? []).sort((a, b) => b.perda - a.perda);
      const indicadores = indicadoresPorSigla.get(i.sigla);
      return {
        sigla: i.sigla,
        nome: i.nome,
        recebido: campi.reduce((s, c) => s + c.recebido, 0),
        perda: campi.reduce((s, c) => s + c.perda, 0),
        rap: indicadores?.rap ?? null,
        iapl: indicadores?.iapl ?? null,
        campi,
      };
    })
    .sort((a, b) => b.perda - a.perda);

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
        <p className="text-neutral-600 dark:text-neutral-400">
          Clique no <strong>+</strong> em frente a uma instituição para simular a RAP e o IAPL dela, e
          para abrir os câmpus e simular evasão e crescimento de matrícula de cada um. Pode abrir
          quantos quadros quiser ao mesmo tempo, em várias instituições e câmpus: cada um soma no total
          daquela instituição e no total da rede, sem precisar escolher um alvo por vez.
        </p>
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>É uma estimativa, não um recálculo da metodologia da CONIF.</strong> Evasão: valor
          recuperado = perda atual × redução simulada. Crescimento de matrícula: ganho = recebido hoje ×
          crescimento simulado, proporcional. RAP e IAPL: reencaixam a instituição numa faixa hipotética
          e recalculam a fatia dela na rede. Serve para dimensionar o efeito, não para prever o valor
          exato que a MDO publicaria.
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

      {arvore.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          O ciclo {ano} não tem nem 6ª fase (evasão) nem indicadores por instituição (RAP/IAPL)
          carregados, então não há nada para simular aqui.
        </p>
      ) : (
        <SimuladorUnificado
          noRede={{ recebido: redeRecebido, perda: redePerda, taxa: redeTaxa }}
          instituicoes={arvore}
          totalBlocoRap={redeQE.totalBlocoRap}
          totalBlocoIapl={redeQE.totalBlocoIapl}
        />
      )}
    </main>
  );
}
