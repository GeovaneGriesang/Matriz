import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { destaqueNaFrente } from "@/lib/destaque";
import { padroesDoCurso } from "@/lib/mdo/padroesCurso";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { PainelConfianca } from "@/components/Confianca";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { SimuladorNovoCurso, type CursoNovoBase } from "@/components/simulador/SimuladorNovoCurso";
import { carregarContextoDoCampus, chaveDoCatalogo } from "@/server/queries/contextoSimulador";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
  curso?: string;
  q?: string;
  tipo?: string;
}

/** O curso de partida quando ninguém escolheu. É só um exemplo: a busca troca por qualquer outro, em qualquer câmpus. */
const CURSO_PADRAO = "TECNICO|INTEGRADO|TECNICO EM ELETROMECANICA|1200";

/** Os tipos de curso que a tela oferece como atalho, com o texto que aparece em cada botão. */
const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: "TECNICO", rotulo: "Técnico" },
  { valor: "BACHARELADO", rotulo: "Bacharelado" },
  { valor: "LICENCIATURA", rotulo: "Licenciatura" },
  { valor: "TECNOLOGIA", rotulo: "Tecnologia" },
  { valor: "QUALIFICACAO PROFISSIONAL (FIC)", rotulo: "FIC" },
  { valor: "ESPECIALIZACAO (LATO SENSU)", rotulo: "Especialização" },
  { valor: "MESTRADO PROFISSIONAL", rotulo: "Mestrado" },
];

/** Os nomes de curso da tabela de pesos são em caixa alta e sem acento. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
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
        Escolha o câmpus e um curso parecido com o que se quer abrir (dele vêm o peso e a carga horária máxima que a MDO paga), diga em que ano a primeira turma entra, quanto dura, a carga
        horária e as vagas. Serve para qualquer tipo de curso (técnico, bacharelado, licenciatura, tecnologia, FIC, pós) em qualquer câmpus da rede. A tela mostra o repasse de cada ano, até o
        curso chegar ao regime, e o acumulado.
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

  // Catálogo de pesos: a edição mais recente da tabela de peso efetivo.
  const anoTabela = (await prisma.pesoEfetivoCurso.aggregate({ _max: { anoReferencia: true } }))._max.anoReferencia;
  const busca = params.q ? normalizar(params.q) : "";
  const tipo = TIPOS.some((t) => t.valor === params.tipo) ? params.tipo : undefined;
  const filtrando = Boolean(busca || tipo);
  const lista = anoTabela
    ? await prisma.pesoEfetivoCurso.findMany({
        where: {
          anoReferencia: anoTabela,
          origem: "DEDUZIDO_DA_MATRICULA_TOTAL",
          ...(tipo ? { tipoCurso: tipo } : { tipoCurso: { in: TIPOS.map((t) => t.valor) } }),
          ...(busca ? { curso: { contains: busca } } : {}),
        },
        orderBy: [{ ciclosObservados: "desc" }],
        take: filtrando ? 40 : 14,
      })
    : [];
  const [tipoP, ofertaP, cursoP, mecP] = (params.curso ?? CURSO_PADRAO).split("|");
  const escolhido =
    (anoTabela
      ? await prisma.pesoEfetivoCurso.findFirst({
          where: { anoReferencia: anoTabela, tipoCurso: tipoP, tipoOferta: ofertaP, curso: cursoP, chMinimaMec: Number(mecP) },
        })
      : null) ?? lista[0];

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

  const contexto = await carregarContextoDoCampus(ano, instituicao.id, campus.id);
  const padroes = padroesDoCurso(escolhido.tipoCurso, escolhido.tipoOferta, escolhido.chMinimaMec);
  const rotuloCurso = `${escolhido.curso}${escolhido.tipoOferta && escolhido.tipoOferta !== "NÃO SE APLICA" ? ` (${escolhido.tipoOferta.toLowerCase()})` : ""}`;
  const base: CursoNovoBase = {
    rotulo: rotuloCurso,
    peso: Number(escolhido.pesoEfetivo),
    chMatriz: padroes.teto,
    chMinimaMec: escolhido.chMinimaMec,
    padroes,
    valorMatricula: contexto.valorMatricula,
    anoDoValor: ano,
    orcamentoCampusHoje: contexto.orcamentoCampusHoje,
    matriculasRede: contexto.matriculasRede,
  };

  const chaveEscolhida = chaveDoCatalogo(escolhido);
  const hrefCurso = (chave: string) => {
    const p = new URLSearchParams({ ano: String(ano), instituicao: instituicao.sigla, campus: String(campus.id), curso: chave });
    return `/simulador/novo-curso?${p.toString()}`;
  };
  const hrefTipo = (valor?: string) => {
    const p = new URLSearchParams({ ano: String(ano), instituicao: instituicao.sigla, campus: String(campus.id), curso: chaveEscolhida });
    if (valor) p.set("tipo", valor);
    if (params.q && valor === tipo) p.set("q", params.q);
    return `/simulador/novo-curso?${p.toString()}`;
  };

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
                href={`/simulador/novo-curso?ano=${ano}&instituicao=${instituicao.sigla}&campus=${u.id}&curso=${encodeURIComponent(chaveEscolhida)}`}
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
          <details className="text-xs" open={filtrando}>
            <summary className="cursor-pointer text-if-green">trocar o curso de referência</summary>
            <div className="mt-1 flex flex-wrap gap-1">
              <Link href={hrefTipo()} className={`rounded px-2 py-0.5 ${!tipo ? "bg-if-green text-white" : "border border-neutral-300 dark:border-neutral-700"}`}>
                todos
              </Link>
              {TIPOS.map((t) => (
                <Link key={t.valor} href={hrefTipo(t.valor)} className={`rounded px-2 py-0.5 ${tipo === t.valor ? "bg-if-green text-white" : "border border-neutral-300 dark:border-neutral-700"}`}>
                  {t.rotulo}
                </Link>
              ))}
            </div>
            <form method="get" className="mt-1 flex gap-1">
              <input type="hidden" name="ano" value={ano} />
              <input type="hidden" name="instituicao" value={instituicao.sigla} />
              <input type="hidden" name="campus" value={campus.id} />
              {tipo && <input type="hidden" name="tipo" value={tipo} />}
              <input name="q" defaultValue={params.q ?? ""} placeholder="buscar, ex.: administração" className="flex-1 rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900" />
              <button type="submit" className="rounded-md bg-if-green px-2 py-1 font-medium text-white">
                Buscar
              </button>
            </form>
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              {lista.length === 0 && <li className="px-2 py-1 text-neutral-500">Nenhum curso encontrado.</li>}
              {lista.map((c) => (
                <li key={c.id}>
                  <Link href={hrefCurso(chaveDoCatalogo(c))} className="block px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    {c.curso} ({c.tipoOferta.toLowerCase()}), peso {Number(c.pesoEfetivo)}, CH mín. {c.chMinimaMec} h
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <SimuladorNovoCurso key={`${campus.id}-${chaveEscolhida}-${ano}`} campus={campus.nome} base={base} campusNoPiso={contexto.noPiso} />
    </main>
  );
}
