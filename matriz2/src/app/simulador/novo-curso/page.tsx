import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { destaqueNaFrente } from "@/lib/destaque";
import { chMatrizPorRegra } from "@/lib/mdo/regrasCiclo";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { PainelConfianca } from "@/components/Confianca";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { SimuladorNovoCurso, type CursoNovoBase } from "@/components/simulador/SimuladorNovoCurso";
import { campusEstaNoPiso, carregarTaxasFuncionamento } from "@/server/queries/funcionamentoCampus";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
  curso?: string;
  q?: string;
}

/** O curso de partida quando ninguém escolheu: o que o câmpus de Venâncio Aires pretende abrir em 2028. */
const CURSO_PADRAO = "TECNICO|INTEGRADO|TECNICO EM ELETROMECANICA|1200";

function moda<T>(valores: T[]): T | undefined {
  const cont = new Map<T, number>();
  for (const v of valores) cont.set(v, (cont.get(v) ?? 0) + 1);
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Os nomes de curso da tabela de pesos são em caixa alta e sem acento. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

export default async function NovoCursoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador/novo-curso");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const sigla = params.instituicao ?? "IFSUL";

  const instituicoes = await prisma.instituicao
    .findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } })
    .then((l) => destaqueNaFrente(l, (i) => i.sigla));
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Abrir um curso novo: quanto rende, ano a ano</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Escolha o câmpus e um curso parecido com o que se quer abrir (dele vêm o peso e a carga horária máxima que a MDO paga), diga em que ano a
        primeira turma entra, quantos anos dura, a carga horária e as vagas. A tela mostra o repasse de cada ano, até o curso chegar ao regime, e o
        acumulado.
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

  const urlPorSigla = Object.fromEntries(instituicoes.map((i) => [i.sigla, `/simulador/novo-curso?ano=${ano}&instituicao=${encodeURIComponent(i.sigla)}`]));

  const porCampus = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano, unidade: { instituicaoId: instituicao.id } },
  });
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

  // Catálogo de pesos: a edição mais recente da tabela de peso efetivo.
  const anoTabela = (await prisma.pesoEfetivoCurso.aggregate({ _max: { anoReferencia: true } }))._max.anoReferencia;
  const busca = params.q ? normalizar(params.q) : "";
  const [candidatos, padrao] = await Promise.all([
    anoTabela && busca
      ? prisma.pesoEfetivoCurso.findMany({
          where: { anoReferencia: anoTabela, origem: "DEDUZIDO_DA_MATRICULA_TOTAL", curso: { contains: busca } },
          orderBy: [{ ciclosObservados: "desc" }],
          take: 30,
        })
      : Promise.resolve([]),
    anoTabela
      ? prisma.pesoEfetivoCurso.findMany({
          where: { anoReferencia: anoTabela, origem: "DEDUZIDO_DA_MATRICULA_TOTAL", tipoCurso: { in: ["TECNICO", "BACHARELADO", "LICENCIATURA"] } },
          orderBy: [{ ciclosObservados: "desc" }],
          take: 12,
        })
      : Promise.resolve([]),
  ]);
  const chaveDe = (l: { tipoCurso: string; tipoOferta: string; curso: string; chMinimaMec: number }) => `${l.tipoCurso}|${l.tipoOferta}|${l.curso}|${l.chMinimaMec}`;
  const todos = [...candidatos, ...padrao];
  const [tipoP, ofertaP, cursoP, mecP] = (params.curso ?? CURSO_PADRAO).split("|");
  const escolhido =
    (anoTabela
      ? await prisma.pesoEfetivoCurso.findFirst({
          where: { anoReferencia: anoTabela, tipoCurso: tipoP, tipoOferta: ofertaP, curso: cursoP, chMinimaMec: Number(mecP) },
        })
      : null) ?? todos[0];

  if (!escolhido) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        <SubmenuSimulador />
        {cabecalho}
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          A tabela de peso efetivo ainda não foi montada. Rode <code>npm run carregar:peso-efetivo -- 2027</code>.
        </p>
      </main>
    );
  }

  // O valor da matrícula e o tamanho do câmpus, dos ciclos do câmpus no ciclo base.
  const ciclos = await prisma.distribuicaoCiclo.findMany({
    where: { ano, unidadeId: campus.id },
    select: { valorAluno: true, valorReais: true },
  });
  const valorMatricula = Number(moda(ciclos.map((c) => Number(c.valorAluno ?? 0)).filter((v) => v > 0)) ?? 0) || 1200;
  const orcamentoCampusHoje = ciclos.reduce((s, c) => s + Number(c.valorReais), 0);

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

  // O teto de CH da matriz: pela regra do tipo e da oferta (3.200 h no integrado de CH mínima 1.200 h). FIC e doutorado não
  // têm teto fixo (usam a CH do ciclo), então ficam sem limite.
  const teto = chMatrizPorRegra(escolhido.tipoCurso, escolhido.tipoOferta, 0, escolhido.chMinimaMec) || 6000;
  const rotuloCurso = `${escolhido.curso}${escolhido.tipoOferta && escolhido.tipoOferta !== "NÃO SE APLICA" ? ` (${escolhido.tipoOferta.toLowerCase()})` : ""}`;
  const base: CursoNovoBase = {
    rotulo: rotuloCurso,
    peso: Number(escolhido.pesoEfetivo),
    chMatriz: teto,
    chMinimaMec: escolhido.chMinimaMec,
    valorMatricula,
    anoDoValor: ano,
    orcamentoCampusHoje,
    matriculasRede,
  };

  const hrefCurso = (chave: string, q?: string) => {
    const p = new URLSearchParams({ ano: String(ano), instituicao: instituicao.sigla, campus: String(campus.id), curso: chave });
    if (q) p.set("q", q);
    return `/simulador/novo-curso?${p.toString()}`;
  };
  const lista = busca ? candidatos : padrao;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <SubmenuSimulador />
      {cabecalho}
      <PainelConfianca ids={["regra-matricula-total", "simulador-curso", "peso-efetivo-tabela"]} />

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
                href={`/simulador/novo-curso?ano=${ano}&instituicao=${instituicao.sigla}&campus=${u.id}&curso=${encodeURIComponent(chaveDe(escolhido))}`}
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
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Curso de referência</span>
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{rotuloCurso}</span>
          <span className="text-xs text-neutral-500">
            {escolhido.tipoCurso}, peso {Number(escolhido.pesoEfetivo)}, CH mínima do MEC {escolhido.chMinimaMec} h
          </span>
          <details className="text-xs" open={Boolean(busca)}>
            <summary className="cursor-pointer text-if-green">trocar o curso de referência</summary>
            <form method="get" className="mt-1 flex gap-1">
              <input type="hidden" name="ano" value={ano} />
              <input type="hidden" name="instituicao" value={instituicao.sigla} />
              <input type="hidden" name="campus" value={campus.id} />
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="buscar, ex.: informática"
                className="flex-1 rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <button type="submit" className="rounded-md bg-if-green px-2 py-1 font-medium text-white">
                Buscar
              </button>
            </form>
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              {lista.length === 0 && <li className="px-2 py-1 text-neutral-500">Nenhum curso encontrado.</li>}
              {lista.map((c) => (
                <li key={c.id}>
                  <Link href={hrefCurso(chaveDe(c))} className="block px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    {c.curso} ({c.tipoOferta.toLowerCase()}), peso {Number(c.pesoEfetivo)}, CH mín. {c.chMinimaMec} h
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <SimuladorNovoCurso key={`${campus.id}-${chaveDe(escolhido)}-${ano}`} campus={campus.nome} base={base} campusNoPiso={noPiso} />
    </main>
  );
}
