import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { destaqueNaFrente, ehCampusDestaque } from "@/lib/destaque";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { SubmenuSimulador } from "@/components/simulador/SubmenuSimulador";
import { carregarCatalogo, carregarContextoDoCampus } from "@/server/queries/contextoSimulador";
import { PROSE_LINK } from "@/lib/layoutWidths";
import { MODALIDADES, ehChaveDeModalidade, modalidadeDoCurso } from "@/lib/modalidadeCurso";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
  /** Filtros da lista de cursos: modalidade, parte do nome, e se o câmpus já oferta o curso. */
  modalidade?: string;
  busca?: string;
  oferta?: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TIPOS_DO_RANKING = ["TECNICO", "BACHARELADO", "LICENCIATURA", "TECNOLOGIA", "QUALIFICACAO PROFISSIONAL (FIC)", "ESPECIALIZACAO (LATO SENSU)", "MESTRADO PROFISSIONAL"];

export default async function OportunidadesPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/simulador/oportunidades");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const sigla = params.instituicao ?? "IFSUL";

  const instituicoes = await prisma.instituicao
    .findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } })
    .then((l) => destaqueNaFrente(l, (i) => i.sigla));
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Onde há ganho</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Duas leituras que o sistema faz sozinho, sem você montar nenhuma simulação: <strong>qual tipo de curso rende mais por vaga</strong> e <strong>onde o câmpus tem carga horária que a MDO não paga</strong>.
        Servem para dar ideias do que simular em seguida em &quot;O que rende mais?&quot;.
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

  const urlPorSigla = Object.fromEntries(instituicoes.map((i) => [i.sigla, `/simulador/oportunidades?ano=${ano}&instituicao=${encodeURIComponent(i.sigla)}`]));
  const porCampus = await prisma.distribuicaoCiclo.groupBy({ by: ["unidadeId"], where: { ano, unidade: { instituicaoId: instituicao.id } } });
  const unidades = await prisma.unidade.findMany({
    where: { id: { in: porCampus.map((c) => c.unidadeId) } },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  // O Venâncio Aires vem primeiro, e é o câmpus padrão quando nenhum foi escolhido.
  unidades.sort((a, b) => Number(ehCampusDestaque(b.nome)) - Number(ehCampusDestaque(a.nome)));
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
  const campusId = Number(params.campus) || unidades.find((u) => ehCampusDestaque(u.nome))?.id || unidades[0]!.id;
  const campus = unidades.find((u) => u.id === campusId) ?? unidades[0]!;

  const [contexto, catalogo, ciclos] = await Promise.all([
    carregarContextoDoCampus(ano, instituicao.id, campus.id),
    carregarCatalogo(),
    prisma.distribuicaoCiclo.findMany({
      where: { ano, unidadeId: campus.id, chMatriz: { gt: 0 } },
      select: { curso: true, tipoOferta: true, cargaHoraria: true, chMatriz: true, qtdAlunosMatriz: true, valorReais: true },
    }),
  ]);

  // Filtros da lista: modalidade, parte do nome (sem acento) e se o câmpus já oferta o curso.
  const modalidade = ehChaveDeModalidade(params.modalidade) ? params.modalidade : undefined;
  const busca = (params.busca ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  const oferta = params.oferta === "nova" || params.oferta === "existente" ? params.oferta : undefined;
  const ofertadosNoCampus = new Set(ciclos.map((c) => `${c.curso}|${c.tipoOferta ?? ""}`));

  // Ranking: o que um aluno que entra rende, do ingresso à formatura, com a CH no teto que a MDO paga.
  const todosDoRanking = catalogo.filter((c) => TIPOS_DO_RANKING.includes(c.tipoCurso));
  const ranking = todosDoRanking
    .filter((c) => !modalidade || modalidadeDoCurso(c.tipoCurso, c.tipoOferta) === modalidade)
    .filter((c) => !busca || c.rotulo.includes(busca))
    .filter((c) => {
      if (!oferta) return true;
      const ja = ofertadosNoCampus.has(`${c.rotulo.replace(/ \(.*\)$/, "")}|${c.tipoOferta}`);
      return oferta === "existente" ? ja : !ja;
    })
    .map((c) => {
      const p = c.padroes;
      const chPaga = Math.min(p.chTotal, p.teto);
      const porIngressante = c.peso * (chPaga / 800) * contexto.valorMatricula;
      const anos = p.mesesDuracao ? p.mesesDuracao / 12 : p.anosDuracao;
      return { ...c, chPaga, porIngressante, porAlunoAno: porIngressante / anos, anos };
    })
    .sort((a, b) => b.porIngressante - a.porIngressante);
  const hrefFiltro = (m: { modalidade?: string; oferta?: string }) => {
    const q = new URLSearchParams({ ano: String(ano), instituicao: instituicao.sigla, campus: String(campus.id) });
    const mod = "modalidade" in m ? m.modalidade : modalidade;
    const ofe = "oferta" in m ? m.oferta : oferta;
    if (mod) q.set("modalidade", mod);
    if (ofe) q.set("oferta", ofe);
    if (params.busca) q.set("busca", params.busca);
    return `/simulador/oportunidades?${q.toString()}`;
  };
  const chip = (ativo: boolean) =>
    `rounded px-2 py-1 text-xs font-medium ${ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`;

  // Horas que não rendem: ciclos do câmpus em que a CH do ciclo passa do teto da matriz.
  const acima = new Map<string, { curso: string; oferta: string; alunos: number; chCiclo: number; chMatriz: number; valor: number }>();
  for (const c of ciclos) {
    if ((c.cargaHoraria ?? 0) <= (c.chMatriz ?? 0)) continue;
    const chave = `${c.curso}|${c.tipoOferta ?? ""}|${c.cargaHoraria}|${c.chMatriz}`;
    const g = acima.get(chave) ?? { curso: c.curso, oferta: c.tipoOferta ?? "", alunos: 0, chCiclo: c.cargaHoraria ?? 0, chMatriz: c.chMatriz ?? 0, valor: 0 };
    g.alunos += Number(c.qtdAlunosMatriz ?? 0);
    g.valor += Number(c.valorReais);
    acima.set(chave, g);
  }
  const horasQueNaoRendem = [...acima.values()]
    .map((g) => ({ ...g, excesso: g.chCiclo - g.chMatriz, horasAlunoPerdidas: (g.chCiclo - g.chMatriz) * g.alunos }))
    .sort((a, b) => b.horasAlunoPerdidas - a.horasAlunoPerdidas)
    .slice(0, 25);
  const totalCiclosComExcesso = [...acima.values()].length;

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <SubmenuSimulador />
      {cabecalho}

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
                href={`/simulador/oportunidades?ano=${ano}&instituicao=${instituicao.sigla}&campus=${u.id}`}
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

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">1. Que tipo de curso rende mais por vaga</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Para cada curso da rede, quanto um aluno que entra rende do ingresso à formatura em {campus.nome}, com a carga horária no teto que a MDO paga. A conta é peso do curso × (carga horária ÷ 800) × valor da matrícula
          ({reais.format(contexto.valorMatricula)} no ciclo {ano}). O que mais pesa é o <strong>peso do curso</strong> (de 1 a 3,75): com a mesma carga horária, um curso de peso 2,5 rende 2,5 vezes o de peso 1.
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          <strong>De onde vêm os cursos e os pesos:</strong> da{" "}
          <Link href="/peso-efetivo" className={PROSE_LINK}>
            tabela de peso efetivo por curso
          </Link>
          , que o sistema monta a partir da Matrícula Total que a MDO publicou para cada ciclo da rede (6ª fase): o peso é o que faz a conta da
          MDO fechar para aquele curso. Entram os cursos mais ofertados na rede ({inteiro.format(todosDoRanking.length)} nesta lista). A duração e a
          carga horária são as típicas do tipo de curso; o valor da matrícula é o do câmpus.
        </p>
        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Modalidade</span>
            <Link href={hrefFiltro({ modalidade: undefined })} className={chip(!modalidade)}>
              Todas
            </Link>
            {MODALIDADES.filter((m) => todosDoRanking.some((c) => modalidadeDoCurso(c.tipoCurso, c.tipoOferta) === m.chave)).map((m) => (
              <Link key={m.chave} href={hrefFiltro({ modalidade: m.chave })} className={chip(modalidade === m.chave)} title={m.ajuda}>
                {m.rotulo}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Neste câmpus</span>
            <Link href={hrefFiltro({ oferta: undefined })} className={chip(!oferta)}>
              Todos
            </Link>
            <Link href={hrefFiltro({ oferta: "nova" })} className={chip(oferta === "nova")}>
              Ainda não ofertados
            </Link>
            <Link href={hrefFiltro({ oferta: "existente" })} className={chip(oferta === "existente")}>
              Já ofertados
            </Link>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="ano" value={ano} />
            <input type="hidden" name="instituicao" value={instituicao.sigla} />
            <input type="hidden" name="campus" value={campus.id} />
            {modalidade && <input type="hidden" name="modalidade" value={modalidade} />}
            {oferta && <input type="hidden" name="oferta" value={oferta} />}
            <input
              name="busca"
              defaultValue={params.busca ?? ""}
              placeholder="Parte do nome do curso, ex.: informática"
              className="w-72 rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button type="submit" className="rounded-md bg-if-green px-3 py-1 text-sm font-medium text-white">
              Filtrar
            </button>
            <span className="text-xs text-neutral-500">
              {inteiro.format(ranking.length)} de {inteiro.format(todosDoRanking.length)} cursos
            </span>
          </form>
        </div>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Curso</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Peso</th>
                <th className="px-3 py-2 text-right">CH paga</th>
                <th className="px-3 py-2 text-right">Duração</th>
                <th className="px-3 py-2 text-right">Por ingressante</th>
                <th className="px-3 py-2 text-right">Por aluno, ao ano</th>
                <th className="px-3 py-2 text-right" title="Em quantos ciclos (turmas) da rede o curso aparece">Turmas na rede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {ranking.map((r) => (
                <tr key={r.chave}>
                  <td className="py-1.5 pr-3">
                    <Link
                      href={`/simulador/novo-curso?ano=${ano}&instituicao=${instituicao.sigla}&campus=${campus.id}&curso=${encodeURIComponent(r.chave)}`}
                      className="hover:underline"
                    >
                      {r.rotulo}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-neutral-500">
                    {r.tipoCurso}
                    {ofertadosNoCampus.has(`${r.rotulo.replace(/ \(.*\)$/, "")}|${r.tipoOferta}`) && (
                      <span className="ml-1 rounded bg-if-green/10 px-1 text-[10px] font-semibold uppercase text-if-green">já no câmpus</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{decimal.format(r.peso)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(r.chPaga)} h</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.anos < 1 ? `${inteiro.format(r.anos * 12)} meses` : `${decimal.format(r.anos)} anos`}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">{reais.format(r.porIngressante)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(r.porAlunoAno)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{inteiro.format(r.ciclos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          Clique num curso para simular a abertura dele neste câmpus. Isto mede só o repasse por aluno: não entra o custo do curso, a demanda por vagas nem a permanência. &quot;Por aluno, ao ano&quot; divide o valor pelo
          tempo de curso, e por isso um FIC de poucos meses parece render muito por ano mesmo rendendo pouco no total.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">2. Onde {campus.nome} tem horas que a MDO não paga</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          A MDO conta no máximo um teto de carga horária por aluno (3.000, 3.100 ou 3.200 h no integrado, a mínima do MEC nos demais). Horas acima do teto não rendem nada. Estes são os cursos do câmpus cujo ciclo tem
          mais horas do que a MDO paga: {totalCiclosComExcesso === 0 ? "nenhum." : `${inteiro.format(totalCiclosComExcesso)} grupos de ciclos, os 25 maiores abaixo.`}
        </p>
        {horasQueNaoRendem.length > 0 && (
          <div className="tabela-rolavel">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-2 pr-3">Curso</th>
                  <th className="px-3 py-2 text-right">CH do ciclo</th>
                  <th className="px-3 py-2 text-right">CH paga</th>
                  <th className="px-3 py-2 text-right">Horas sem repasse</th>
                  <th className="px-3 py-2 text-right">Alunos</th>
                  <th className="px-3 py-2 text-right">Horas de aluno sem repasse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {horasQueNaoRendem.map((g) => (
                  <tr key={`${g.curso}-${g.oferta}-${g.chCiclo}-${g.chMatriz}`}>
                    <td className="py-1.5 pr-3">
                      {g.curso}
                      {g.oferta && g.oferta !== "NÃO SE APLICA" ? ` (${g.oferta.toLowerCase()})` : ""}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(g.chCiclo)} h</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(g.chMatriz)} h</td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">{inteiro.format(g.excesso)} h</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(g.alunos)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(g.horasAlunoPerdidas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-neutral-500">
          Duas leituras possíveis, e quem decide é o projeto pedagógico: (1) enxugar essas horas, se o curso puder, não reduz o repasse e alivia professor e sala; (2) ao planejar um curso novo, carga horária além do teto
          é custo sem receita (o simulador de curso novo avisa isso). A coluna da direita multiplica as horas sem repasse pelos alunos, para mostrar onde o excesso pesa mais.
        </p>
      </section>
    </main>
  );
}
