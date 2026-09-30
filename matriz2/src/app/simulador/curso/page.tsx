import Link from "next/link";
import { PainelConfianca } from "@/components/Confianca";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { SimuladorCursoAnos, type CursoBase } from "@/components/simulador/SimuladorCursoAnos";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { campusEstaNoPiso, carregarTaxasFuncionamento } from "@/server/queries/funcionamentoCampus";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
  curso?: string;
}

function moda<T>(valores: T[]): T | undefined {
  const cont = new Map<T, number>();
  for (const v of valores) cont.set(v, (cont.get(v) ?? 0) + 1);
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export default async function SimuladorCursoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador/curso");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const sigla = params.instituicao ?? "IFSUL";

  const instituicoes = await prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } });
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];
  if (!instituicao) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} px-6 py-16 lg:px-12`}>
        <h1 className="text-2xl font-semibold">Simulador de curso</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">Nenhum dado carregado ainda.</p>
      </main>
    );
  }

  // Câmpus da instituição com ciclos (6ª fase) no ano.
  const porCampus = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano, unidade: { instituicaoId: instituicao.id } },
    _sum: { valorReais: true },
  });
  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampus.map((c) => c.unidadeId) } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  const urlPorSigla = Object.fromEntries(
    instituicoes.map((i) => [i.sigla, `/simulador/curso?ano=${ano}&instituicao=${encodeURIComponent(i.sigla)}`]),
  );

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Simulador de curso: 3 ou 4 anos?</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Escolha um câmpus e um curso como ponto de partida, e compare duas formas de ofertá-lo, por exemplo uma turma de
        ensino médio integrado de 3 anos contra uma de 4. A tela mostra quanto cada uma rende por aluno, por ano e no
        acumulado, usando a mesma regra de Matrícula Total da MDO.
      </p>
    </div>
  );

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

  const ciclos = await prisma.distribuicaoCiclo.findMany({
    where: { ano, unidadeId: campus.id },
    select: {
      curso: true,
      tipoOferta: true,
      pesoCursoMatriz: true,
      chMatriz: true,
      qtdAlunosMatriz: true,
      valorReais: true,
      valorAluno: true,
      agropecuaria: true,
    },
  });
  const grupos = new Map<string, typeof ciclos>();
  for (const c of ciclos) {
    const chave = `${c.curso}|${c.tipoOferta ?? ""}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), c]);
  }
  const cursos = [...grupos.entries()]
    .map(([chave, lista]) => {
      const oferta = lista[0]!.tipoOferta;
      return {
        chave,
        rotulo: `${lista[0]!.curso}${oferta && oferta !== "NÃO SE APLICA" ? ` (${oferta.toLowerCase()})` : ""}`,
        lista,
        valor: lista.reduce((s, c) => s + Number(c.valorReais), 0),
        integrado: oferta === "INTEGRADO",
      };
    })
    .sort((a, b) => Number(b.integrado) - Number(a.integrado) || b.valor - a.valor);

  const escolhido = cursos.find((c) => c.chave === params.curso) ?? cursos[0];
  if (!escolhido) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <p className="text-neutral-600 dark:text-neutral-400">
          {campus.nome} não tem ciclos em {ano}.
        </p>
      </main>
    );
  }

  const l = escolhido.lista;
  const valorMatricula = Number(moda(l.map((c) => Number(c.valorAluno ?? 0)).filter((v) => v > 0)) ?? 0);
  const base: CursoBase = {
    rotulo: escolhido.rotulo,
    peso: Number(moda(l.map((c) => Number(c.pesoCursoMatriz ?? 1))) ?? 1),
    agropecuaria: l.some((c) => c.agropecuaria === true),
    chMatriz: Math.max(...l.map((c) => c.chMatriz ?? 0), 800),
    valorMatricula: valorMatricula || 1200,
    alunosHoje: l.reduce((s, c) => s + Number(c.qtdAlunosMatriz ?? 0), 0),
    valorHoje: escolhido.valor,
    ciclosHoje: l.length,
  };

  // Piso Mínimo e matrícula total da rede (esta última para a diluição do valor).
  const [taxas, distCampus, parametros] = await Promise.all([
    carregarTaxasFuncionamento(ano),
    prisma.distribuicaoCampus.findUnique({ where: { ano_unidadeId: { ano, unidadeId: campus.id } } }),
    prisma.parametrosParticipacao.findUnique({ where: { ano_instituicaoId: { ano, instituicaoId: instituicao.id } } }),
  ]);
  const noPiso =
    taxas && distCampus
      ? campusEstaNoPiso(taxas, {
          mtPresencial: Number(distCampus.mtPresencial ?? 0),
          mtEad: Number(distCampus.mtEad ?? 0),
          mtEadMooc: Number(distCampus.mtEadMooc ?? 0),
          mtEadFp: Number(distCampus.mtEadFp ?? 0),
          elegivelPiso: distCampus.elegivelPiso,
        })
      : false;
  const matriculasRede = parametros
    ? Number(parametros.matriculasPresencial) +
      Number(parametros.matriculasEad) * Number(parametros.pesoEad) +
      Number(parametros.matriculasEadMooc) * Number(parametros.pesoEadMooc) +
      Number(parametros.matriculasEadFp) * Number(parametros.pesoEadFp)
    : 1_500_000;

  const hrefCurso = (chave: string) => {
    const q = new URLSearchParams({ ano: String(ano), instituicao: instituicao.sigla, campus: String(campus.id), curso: chave });
    return `/simulador/curso?${q.toString()}`;
  };

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <SubmenuSimulador />
      {cabecalho}
      <PainelConfianca ids={["regra-matricula-total", "simulador-curso", ...(instituicao.sigla === "IFSUL" ? (["ifsul-5a-vs-6a"] as const) : [])]} />

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 md:grid-cols-3">
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
                href={`/simulador/curso?ano=${ano}&instituicao=${instituicao.sigla}&campus=${u.id}`}
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
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Curso de partida</span>
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{escolhido.rotulo}</span>
          <details className="text-xs">
            <summary className="cursor-pointer text-if-green">trocar curso ({cursos.length})</summary>
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              {cursos.map((c) => (
                <li key={c.chave}>
                  <Link href={hrefCurso(c.chave)} className="block px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    {c.rotulo}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <SimuladorCursoAnos
        key={`${campus.id}-${escolhido.chave}-${ano}`}
        campus={campus.nome}
        ano={ano}
        base={base}
        campusNoPiso={noPiso}
        matriculasRede={matriculasRede}
      />
    </main>
  );
}
