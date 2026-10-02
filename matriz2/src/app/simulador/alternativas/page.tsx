import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { destaqueNaFrente } from "@/lib/destaque";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { PainelConfianca } from "@/components/Confianca";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { ComparadorAlternativas, type ContextoBase } from "@/components/simulador/ComparadorAlternativas";
import { carregarCatalogo, carregarContextoDoCampus, carregarIndicadoresDaInstituicao } from "@/server/queries/contextoSimulador";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
}

export default async function AlternativasPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador/alternativas");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const sigla = params.instituicao ?? "IFSUL";

  const instituicoes = await prisma.instituicao
    .findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } })
    .then((l) => destaqueNaFrente(l, (i) => i.sigla));
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">O que rende mais?</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Ponha lado a lado as coisas que um câmpus pode fazer para receber mais: um curso de 3 anos contra um de 4, melhorar a RAP, abrir uma turma FIC de 160 h, um
        bacharelado novo, reduzir a evasão, ocupar mais vagas. Cada uma vira o mesmo número, o ganho em reais por ano, e a tela mostra qual rende mais, qual começa antes e o que cada uma exige
        de alunos novos. Já abre com quatro exemplos; mude, remova ou adicione o que quiser.
      </p>
    </div>
  );

  if (!instituicao) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">Nenhum dado carregado ainda.</p>
      </main>
    );
  }

  const urlPorSigla = Object.fromEntries(instituicoes.map((i) => [i.sigla, `/simulador/alternativas?ano=${ano}&instituicao=${encodeURIComponent(i.sigla)}`]));
  const porCampus = await prisma.distribuicaoCiclo.groupBy({ by: ["unidadeId"], where: { ano, unidade: { instituicaoId: instituicao.id } } });
  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampus.map((c) => c.unidadeId) } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  if (unidades.length === 0) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <div className="max-w-md">
          <SeletorInstituicao instituicoes={instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={urlPorSigla} />
        </div>
        <p className="text-neutral-600 dark:text-neutral-400">
          {instituicao.sigla} não tem ciclos (6ª fase) carregados em {ano}.
        </p>
      </main>
    );
  }

  const campusId = Number(params.campus) || unidades.find((u) => /VEN[ÂA]NCIO AIRES/i.test(u.nome))?.id || unidades[0]!.id;
  const campus = unidades.find((u) => u.id === campusId) ?? unidades[0]!;

  const [contexto, indicadores, catalogo] = await Promise.all([
    carregarContextoDoCampus(ano, instituicao.id, campus.id),
    carregarIndicadoresDaInstituicao(ano, instituicao.sigla),
    carregarCatalogo(),
  ]);
  const base: ContextoBase = {
    valorMatricula: contexto.valorMatricula,
    anoDoValor: ano,
    orcamentoCampusHoje: contexto.orcamentoCampusHoje,
    perdaCampus: contexto.perdaCampus,
    alunosCampus: contexto.alunosCampus,
    indicadores,
  };

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <SubmenuSimulador />
      {cabecalho}
      <PainelConfianca ids={["regra-matricula-total", "simulador-curso", "peso-efetivo-tabela", "distribuicao-indices"]} />

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          <SeletorInstituicao instituicoes={instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={urlPorSigla} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Câmpus</span>
          <div className="flex flex-wrap gap-1">
            {unidades.map((u) => (
              <Link
                key={u.id}
                href={`/simulador/alternativas?ano=${ano}&instituicao=${instituicao.sigla}&campus=${u.id}`}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  u.id === campus.id
                    ? "bg-if-green text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {u.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <ComparadorAlternativas key={`${campus.id}-${ano}`} campus={campus.nome} instituicao={instituicao.sigla} base={base} catalogo={catalogo} campusNoPiso={contexto.noPiso} />
    </main>
  );
}
