import { destaqueNaFrente, ehCampusDestaque } from "@/lib/destaque";
import Link from "next/link";
import { PainelConfianca } from "@/components/Confianca";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { SeletorInstituicao } from "@/components/SeletorInstituicao";
import { analisarCiclo, periodoDoCiclo, type AnaliseAluno } from "@/lib/mdo/valorAluno";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  instituicao?: string;
  campus?: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec4 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct3 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const dataCurta = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "-");
const n = (v: unknown) => Number(v ?? 0);

export default async function ValorDoAlunoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/consulta/valor-do-aluno");
  const params = await searchParams;
  const ano = Number(params.ano) || 2027;
  const sigla = params.instituicao ?? "IFSUL";

  const instituicoes = await prisma.instituicao.findMany({ orderBy: { sigla: "asc" }, select: { id: true, sigla: true, nome: true } }).then((l) => destaqueNaFrente(l, (i) => i.sigla));
  const instituicao = instituicoes.find((i) => i.sigla === sigla) ?? instituicoes[0];
  const urlPorSigla = Object.fromEntries(
    instituicoes.map((i) => [i.sigla, `/consulta/valor-do-aluno?ano=${ano}&instituicao=${encodeURIComponent(i.sigla)}`]),
  );

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <Link href={`/consulta?ano=${ano}`} className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
        ← Consulta
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Quanto vale um aluno</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Para cada curso de um câmpus: quanto um aluno rende no orçamento, em reais e em percentual do orçamento do câmpus, e por
        quê. Abra um curso para ver a conta de cada turma, fator por fator. Detalhes da regra em{" "}
        <Link href="/como-funciona#funcionamento" className={PROSE_LINK}>
          Como funciona
        </Link>
        .
      </p>
    </div>
  );

  if (!instituicao) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} flex flex-col gap-6 px-6 py-12 lg:px-12`}>
        {cabecalho}
        <p className="text-neutral-600 dark:text-neutral-400">Nenhum dado carregado ainda.</p>
      </main>
    );
  }

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
  // O Venâncio Aires vem primeiro, e é o câmpus padrão quando nenhum foi escolhido.
  unidades.sort((a, b) => Number(ehCampusDestaque(b.nome)) - Number(ehCampusDestaque(a.nome)));

  const seletorInstituicao = (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
      <SeletorInstituicao instituicoes={instituicoes} siglaEscolhida={instituicao.sigla} urlPorSigla={urlPorSigla} />
    </div>
  );

  if (unidades.length === 0) {
    return (
      <main className={`mx-auto ${TABLE_MAX_WIDTH} flex flex-col gap-6 px-6 py-12 lg:px-12`}>
        {cabecalho}
        <div className="max-w-md">{seletorInstituicao}</div>
        <p className="text-neutral-600 dark:text-neutral-400">
          {instituicao.sigla} não tem ciclos (6ª fase) carregados em {ano}.
        </p>
      </main>
    );
  }

  const campusId = Number(params.campus) || unidades.find((u) => ehCampusDestaque(u.nome))?.id || unidades[0]!.id;
  const campus = unidades.find((u) => u.id === campusId) ?? unidades[0]!;

  const [ciclos, fonteParametros] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({ where: { ano, unidadeId: campus.id }, orderBy: { valorReais: "desc" } }),
    prisma.parametrosParticipacao.findUnique({ where: { ano_instituicaoId: { ano, instituicaoId: instituicao.id } } }),
  ]);
  const periodo = fonteParametros
    ? { inicio: fonteParametros.periodoInicio, fim: fonteParametros.periodoFim }
    : periodoDoCiclo(ano);

  const totalCampus = ciclos.reduce((s, c) => s + n(c.valorReais), 0);
  const alunosCampus = ciclos.reduce((s, c) => s + n(c.qtdAlunosMatriz), 0);

  interface CicloAnalisado {
    id: number;
    ciclo: string;
    inicio: Date | null;
    termino: Date | null;
    alunos: number;
    valor: number;
    analise: AnaliseAluno | null;
  }
  const porCurso = new Map<string, { rotulo: string; ciclos: CicloAnalisado[] }>();
  for (const c of ciclos) {
    const oferta = c.tipoOferta && c.tipoOferta !== "NÃO SE APLICA" ? ` (${c.tipoOferta.toLowerCase()})` : "";
    const chave = `${c.curso}|${c.tipoOferta ?? ""}|${c.repasse}`;
    const analise = analisarCiclo(
      {
        inicio: c.inicio,
        termino: c.termino,
        jubilamento: c.jubilamento,
        chMinimaMec: c.chMinimaMec,
        cargaHoraria: c.cargaHoraria,
        chMatriz: c.chMatriz,
        peso: c.pesoCursoMatriz ? n(c.pesoCursoMatriz) : null,
        alunos: c.qtdAlunosMatriz ? n(c.qtdAlunosMatriz) : null,
        matriculaTotal: n(c.matriculaTotal),
        valorReais: n(c.valorReais),
        valorMatricula: c.valorAluno ? n(c.valorAluno) : null,
        agropecuaria: c.agropecuaria,
      },
      periodo,
    );
    const item: CicloAnalisado = {
      id: c.id,
      ciclo: c.ciclo,
      inicio: c.inicio,
      termino: c.termino,
      alunos: n(c.qtdAlunosMatriz),
      valor: n(c.valorReais),
      analise,
    };
    const atual = porCurso.get(chave) ?? { rotulo: `${c.curso}${oferta}${c.repasse === "PRESENCIAL" ? "" : `, ${c.repasse.replace("_", " ")}`}`, ciclos: [] };
    atual.ciclos.push(item);
    porCurso.set(chave, atual);
  }

  const cursos = [...porCurso.entries()]
    .map(([chave, g]) => {
      const alunos = g.ciclos.reduce((s, c) => s + c.alunos, 0);
      const valor = g.ciclos.reduce((s, c) => s + c.valor, 0);
      const comAnalise = g.ciclos.filter((c) => c.analise && c.alunos > 0);
      const alunosAnalisados = comAnalise.reduce((s, c) => s + c.alunos, 0);
      // Média ponderada por aluno do valor de "ano cheio" dos ciclos.
      const anoCheio =
        alunosAnalisados > 0 ? comAnalise.reduce((s, c) => s + c.analise!.valorAnoCheioPorAluno * c.alunos, 0) / alunosAnalisados : 0;
      return {
        chave,
        rotulo: g.rotulo,
        ciclos: g.ciclos.sort((a, b) => b.valor - a.valor),
        alunos,
        valor,
        valorPorAluno: alunos > 0 ? valor / alunos : 0,
        anoCheio,
      };
    })
    .filter((c) => c.valor > 0 || c.alunos > 0)
    .sort((a, b) => b.valor - a.valor);

  const [distCampus] = await Promise.all([
    prisma.distribuicaoCampus.findUnique({ where: { ano_unidadeId: { ano, unidadeId: campus.id } }, select: { vlMatrFinal: true, elegivelPiso: true } }),
  ]);
  const funcionamentoFinal = distCampus?.vlMatrFinal ? n(distCampus.vlMatrFinal) : null;

  return (
    <main className={`mx-auto ${TABLE_MAX_WIDTH} flex flex-col gap-6 px-6 py-12 lg:px-12`}>
      {cabecalho}
      <PainelConfianca
        ids={[
          ...(instituicao.sigla === "IFSUL" ? (["sexta-fase-ifsul", "regra-matricula-total", "ifsul-5a-vs-6a"] as const) : (["rede-sexta-fase", "agropecuaria-inferida"] as const)),
          "valor-aluno-definicoes",
        ]}
      />

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 md:grid-cols-[minmax(0,20rem)_1fr]">
        {seletorInstituicao}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Câmpus</span>
          <div className="flex flex-wrap gap-1">
            {unidades.map((u) => (
              <Link
                key={u.id}
                href={`/consulta/valor-do-aluno?ano=${ano}&instituicao=${instituicao.sigla}&campus=${u.id}`}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Cartao rotulo={`Orçamento de ${campus.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}, por matrícula`} valor={reais0.format(totalCampus)} nota={`soma dos ciclos de ${ano}, antes do Piso Mínimo`} />
        <Cartao rotulo="Alunos nos ciclos" valor={inteiro.format(alunosCampus)} />
        <Cartao rotulo="Valor médio de um aluno" valor={alunosCampus > 0 ? reais.format(totalCampus / alunosCampus) : "-"} nota={alunosCampus > 0 ? `${pct3.format((1 / alunosCampus) * 100)}% do orçamento, se todos valessem igual` : undefined} />
      </div>

      {funcionamentoFinal !== null && distCampus?.elegivelPiso && funcionamentoFinal > totalCampus * 1.001 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Este câmpus está no Piso Mínimo: recebe {reais0.format(funcionamentoFinal)} de Funcionamento, acima dos{" "}
          {reais0.format(totalCampus)} que a soma dos ciclos dá. Para o orçamento real dele, cada aluno vale menos do que aparece
          abaixo (o piso já cobre o que a matrícula não cobre).
        </p>
      )}

      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">Curso</th>
              <th className="px-3 py-2 text-right">Alunos</th>
              <th className="px-3 py-2 text-right">Valor do curso</th>
              <th className="px-3 py-2 text-right">% do câmpus</th>
              <th className="px-3 py-2 text-right">Um aluno vale</th>
              <th className="px-3 py-2 text-right">% do câmpus, por aluno</th>
              <th className="px-3 py-2 text-right" title="O que um aluno rende por ano quando cursa o ano inteiro">Ano cheio</th>
            </tr>
          </thead>
          {cursos.map((c) => (
            <tbody key={c.chave} className="border-t border-neutral-200 dark:border-neutral-800">
              <tr>
                <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                  <details>
                    <summary className="cursor-pointer">{c.rotulo}</summary>
                    <div className="mt-2 tabela-rolavel rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                      <table className="w-full text-xs font-normal">
                        <thead className="bg-neutral-50 text-left uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                          <tr>
                            <th className="px-2 py-1.5">Turma</th>
                            <th className="px-2 py-1.5 text-right">Alunos</th>
                            <th className="px-2 py-1.5 text-right" title="Peso do curso (laboratórios)">Peso</th>
                            <th className="px-2 py-1.5 text-right" title="CH que conta ÷ 800">CH ÷ 800</th>
                            <th className="px-2 py-1.5 text-right" title="Dias do ciclo dentro do ano-base ÷ dias do ciclo">Dias</th>
                            <th className="px-2 py-1.5 text-right" title="Fração de alunos que conta (retidos contam metade)">ICQA</th>
                            <th className="px-2 py-1.5 text-right">Matrícula por aluno</th>
                            <th className="px-2 py-1.5 text-right">Aluno vale</th>
                            <th className="px-2 py-1.5 text-right">% do câmpus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {c.ciclos.map((t) => {
                            const d = t.analise?.decomposicao;
                            return (
                              <tr key={t.id}>
                                <td className="px-2 py-1.5 text-neutral-700 dark:text-neutral-300">
                                  {dataCurta(t.inicio)} a {dataCurta(t.termino)}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{inteiro.format(t.alunos)}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">
                                  {d ? dec2.format(d.peso) : "-"}
                                  {d && d.bonusAgropecuaria > 1 && <span title="Agropecuária, +50%"> ×1,5</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{d ? dec4.format(d.fatorCargaHoraria) : "-"}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums" title={d ? `${d.diasAtivos} de ${d.diasDoCiclo} dias` : ""}>
                                  {d ? dec4.format(d.fatorDias) : "-"}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{d ? dec2.format(d.icqa) : "-"}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{d ? dec4.format(d.matriculaTotal / d.alunos) : "-"}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{t.alunos > 0 ? reais.format(t.valor / t.alunos) : "-"}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">
                                  {t.alunos > 0 && totalCampus > 0 ? `${pct3.format((t.valor / t.alunos / totalCampus) * 100)}%` : "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <p className="border-t border-neutral-100 px-2 py-1.5 text-xs text-neutral-500 dark:border-neutral-800">
                        Aluno vale = peso × ICQA × (CH ÷ 800) × dias × valor de uma matrícula. Cada coluna acima é um desses fatores.
                      </p>
                    </div>
                  </details>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(c.alunos)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{reais0.format(c.valor)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalCampus > 0 ? `${dec2.format((c.valor / totalCampus) * 100)}%` : "-"}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{c.alunos > 0 ? reais.format(c.valorPorAluno) : "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.alunos > 0 && totalCampus > 0 ? `${pct3.format((c.valorPorAluno / totalCampus) * 100)}%` : "-"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{c.anoCheio > 0 ? reais.format(c.anoCheio) : "-"}</td>
              </tr>
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <p>
          <strong>Um aluno vale</strong> é o valor do curso dividido pelos alunos que ele tem: o que cada um rendeu neste ciclo
          orçamentário, incluindo turmas que começaram ou terminaram no meio do ano-base (essas rendem só os dias que caem nele) e
          alunos retidos (contam metade). <strong>Ano cheio</strong> é o que um aluno rende por ano quando cursa o ano inteiro e
          conta por inteiro: serve para comparar cursos sem essas distorções.
        </p>
        <p>
          O percentual é o valor do aluno sobre o orçamento do câmpus por matrícula ({reais0.format(totalCampus)}). Ele é pequeno
          porque o câmpus tem {inteiro.format(alunosCampus)} alunos; o que interessa é comparar entre cursos: um aluno de um curso
          de peso 2,5 vale o dobro de um de peso 1,25, todo o resto igual.
        </p>
        {fonteParametros && (
          <p className="text-xs text-neutral-500">
            Valor de uma matrícula presencial usado nesta base: {reais.format(n(fonteParametros.valorMatriculaPresencial))} (6ª fase de{" "}
            {instituicao.sigla}, ajuste de {reais0.format(n(fonteParametros.ajuste))}).
          </p>
        )}
      </div>
    </main>
  );
}

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</div>
      {nota && <div className="mt-0.5 text-xs text-neutral-500">{nota}</div>}
    </div>
  );
}
