import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { PainelConfianca } from "@/components/Confianca";
import { valorDoCurso } from "@/lib/mdo/valorDoCurso";
import type { Repasse } from "@/lib/mdo/matriculaTotal";

export const dynamic = "force-dynamic";

interface Busca {
  q?: string;
  tipo?: string;
  oferta?: string;
  modalidade?: string;
  anos?: string;
  /** "1" quando a pessoa clicou em Buscar. */
  buscar?: string;
}

const LIMITE = 80;
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const MODALIDADES: Array<{ valor: Repasse; rotulo: string }> = [
  { valor: "PRESENCIAL", rotulo: "Presencial" },
  { valor: "EAD_FP", rotulo: "A distância, financiamento próprio (80% do presencial)" },
  { valor: "EAD", rotulo: "A distância, financiamento externo (25% do presencial)" },
  { valor: "EAD_MOOC", rotulo: "A distância, MOOC (8% do presencial)" },
];

const EXEMPLOS = ["Informática", "Enfermagem", "Agropecuária", "Engenharia", "Licenciatura", "Administração"];

const campo =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

function moda(valores: number[]): number | undefined {
  const cont = new Map<number, number>();
  for (const v of valores) cont.set(v, (cont.get(v) ?? 0) + 1);
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export default async function QuantoValeUmCursoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/consulta/curso");
  const params = await searchParams;

  const anos = await prisma.pesoEfetivoCurso.groupBy({ by: ["anoReferencia"], orderBy: { anoReferencia: "desc" } });
  const ano = anos[0]?.anoReferencia;

  const cabecalho = (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Quanto vale um curso?</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Procure um curso que você pensa em ofertar e veja o que a matriz considera dele: o <strong>peso</strong>, a <strong>carga horária mínima</strong> do MEC, a
        carga horária que vale na matriz e quanto a MDO paga, em média, por um aluno que faz o curso inteiro. Serve para comparar cursos antes de abrir turma.
      </p>
    </div>
  );

  if (!ano) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-4 px-6 py-12 lg:px-12`}>
        {cabecalho}
        <p className="text-neutral-600 dark:text-neutral-400">
          A tabela de pesos ainda não foi montada. Rode <code>npm run carregar:peso-efetivo -- 2027</code>.
        </p>
      </main>
    );
  }

  const tipos = await prisma.pesoEfetivoCurso.groupBy({ by: ["tipoCurso"], where: { anoReferencia: ano }, orderBy: { tipoCurso: "asc" } });
  const ofertas = await prisma.pesoEfetivoCurso.groupBy({ by: ["tipoOferta"], where: { anoReferencia: ano }, orderBy: { tipoOferta: "asc" } });

  const buscou = params.buscar === "1" || Boolean(params.q);
  const modalidade = (MODALIDADES.find((m) => m.valor === params.modalidade)?.valor ?? "PRESENCIAL") as Repasse;
  const anosDeCurso = Number(params.anos?.replace(",", ".")) > 0 ? Number(params.anos?.replace(",", ".")) : undefined;

  // O valor de uma matrícula presencial: o mais comum entre os ciclos presenciais do IFSul no ciclo (a MDO a calcula por ciclo orçamentário).
  const ciclosDeReferencia = buscou
    ? await prisma.distribuicaoCiclo.findMany({
        where: { ano, repasse: "PRESENCIAL", valorAluno: { gt: 0 }, unidade: { instituicao: { sigla: "IFSUL" } } },
        select: { valorAluno: true },
      })
    : [];
  const valorMatriculaPresencial = moda(ciclosDeReferencia.map((c) => Math.round(Number(c.valorAluno) * 100) / 100)) ?? 0;

  const where: Prisma.PesoEfetivoCursoWhereInput = { anoReferencia: ano };
  if (params.q?.trim()) where.curso = { contains: params.q.trim() };
  if (params.tipo) where.tipoCurso = params.tipo;
  if (params.oferta) where.tipoOferta = params.oferta;
  const [linhas, total] = buscou
    ? await Promise.all([
        prisma.pesoEfetivoCurso.findMany({ where, orderBy: [{ ciclosObservados: "desc" }, { curso: "asc" }], take: LIMITE }),
        prisma.pesoEfetivoCurso.count({ where }),
      ])
    : [[], 0];

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      {cabecalho}
      <PainelConfianca ids={["peso-efetivo-tabela"]} />

      <form method="get" className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="buscar" value="1" />
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Nome do curso contém</span>
          <input name="q" defaultValue={params.q ?? ""} placeholder="ex.: informática, enfermagem" className={campo} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tipo de curso</span>
          <select name="tipo" defaultValue={params.tipo ?? ""} className={campo}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.tipoCurso} value={t.tipoCurso}>
                {t.tipoCurso}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Oferta</span>
          <select name="oferta" defaultValue={params.oferta ?? ""} className={campo}>
            <option value="">Todas</option>
            {ofertas
              .filter((o) => o.tipoOferta !== "*")
              .map((o) => (
                <option key={o.tipoOferta} value={o.tipoOferta}>
                  {o.tipoOferta}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Modalidade</span>
          <select name="modalidade" defaultValue={modalidade} className={campo}>
            {MODALIDADES.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" title="Opcional. Com a duração, a tela também mostra quanto a MDO paga por aluno em cada ano.">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Duração (anos, opcional)</span>
          <input name="anos" type="number" min={0.25} max={10} step={0.5} defaultValue={params.anos ?? ""} placeholder="ex.: 3" className={campo} />
        </label>
        <div className="flex items-end lg:col-span-1">
          <button type="submit" className="w-full rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90">
            Buscar
          </button>
        </div>
      </form>

      {!buscou && (
        <div className="flex flex-col gap-3 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">
          <p className="font-medium">Digite o nome de um curso e clique em Buscar.</p>
          <p>Ou comece por um destes:</p>
          <div className="flex flex-wrap gap-2">
            {EXEMPLOS.map((e) => (
              <Link
                key={e}
                href={`/consulta/curso?q=${encodeURIComponent(e)}&buscar=1`}
                className="rounded-full border border-sky-400 px-3 py-1 text-xs font-medium hover:bg-sky-100 dark:hover:bg-sky-900"
              >
                {e}
              </Link>
            ))}
          </div>
        </div>
      )}

      {buscou && (
        <>
          <p className="text-xs text-neutral-500">
            {inteiro.format(total)} curso(s) encontrado(s){total > LIMITE ? `; mostrando os ${LIMITE} com mais ciclos, refine a busca para ver os demais` : ""}. Valor de uma matrícula
            presencial usado: <strong>{reais2.format(valorMatriculaPresencial)}</strong> (o mais comum entre os ciclos presenciais do IFSul em {ano}); na modalidade escolhida, a MDO paga{" "}
            {modalidade === "PRESENCIAL" ? "o valor inteiro" : `uma fração dele`}. Os pesos vêm da tabela de pesos do ciclo {ano}.
          </p>
          {linhas.length === 0 ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Nenhum curso encontrado com esses filtros. Tente uma parte menor do nome (por exemplo &quot;infor&quot;) ou tire o tipo de curso.
            </p>
          ) : (
            <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                  <tr>
                    <th className="px-3 py-2">Curso</th>
                    <th className="px-3 py-2">Tipo e oferta</th>
                    <th className="px-3 py-2 text-right" title="Carga horária mínima que o MEC define para o curso.">
                      CH mínima MEC
                    </th>
                    <th className="px-3 py-2 text-right" title="A carga horária que a matriz aceita contar, limitada por regra.">
                      CH que vale
                    </th>
                    <th className="px-3 py-2 text-right" title="Quantas vezes um aluno de peso 1 este aluno conta.">
                      Peso
                    </th>
                    <th className="px-3 py-2 text-right" title="Peso x carga horária que vale / 800.">
                      Matrículas por aluno
                    </th>
                    <th className="px-3 py-2 text-right" title="O que a MDO paga por um aluno que faz o curso inteiro, sem evadir.">
                      R$ por aluno, curso inteiro
                    </th>
                    {anosDeCurso && <th className="px-3 py-2 text-right">R$ por aluno por ano</th>}
                    <th className="px-3 py-2 text-right" title="Em quantos ciclos reais da MDO este peso foi observado.">
                      Ciclos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {linhas.map((l) => {
                    const v = valorDoCurso({
                      tipoCurso: l.tipoCurso,
                      tipoOferta: l.tipoOferta,
                      chMinimaMec: l.chMinimaMec,
                      pesoEfetivo: Number(l.pesoEfetivo),
                      valorMatriculaPresencial,
                      repasse: modalidade,
                      anosDeCurso,
                    });
                    return (
                      <tr key={l.id} className="align-top" title={l.fonte}>
                        <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">{l.curso === "*" ? "Qualquer curso FIC fora do catálogo" : l.curso}</td>
                        <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                          {l.tipoCurso}
                          {l.tipoOferta !== "*" && l.tipoOferta !== "NÃO SE APLICA" ? <span className="block text-xs">{l.tipoOferta.toLowerCase()}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(l.chMinimaMec)} h</td>
                        <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(v.chMatriz)} h</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{decimal.format(Number(l.pesoEfetivo))}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{decimal.format(v.matriculasEquivalentesPorAluno)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{reais.format(v.valorPorAlunoNoCurso)}</td>
                        {anosDeCurso && <td className="px-3 py-2 text-right tabular-nums">{v.valorPorAlunoPorAno !== null ? reais.format(v.valorPorAlunoPorAno) : "-"}</td>}
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{inteiro.format(l.ciclosObservados)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <details open={!buscou} className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">Como ler esta tela</summary>
        <dl className="mt-3 flex flex-col gap-3">
          <Termo nome="Peso do curso">
            Quantas vezes um aluno deste curso conta, em relação a um aluno de peso 1,0. Vem do custo do curso (laboratórios, por exemplo): peso 1,5 quer dizer que cada aluno conta uma
            vez e meia. Referências da Portaria MEC 243/2026: qualificação profissional (FIC) 1,0; ensino médio e fundamental II 1,5; fundamental I 2,0; Proeja 2,5; licenciaturas 2,5;
            cursos técnicos de 1,0 a 2,5 conforme o número de laboratórios do Catálogo Nacional de Cursos Técnicos (o integrado tem no mínimo 1,5); tecnologia e bacharelado, pelo mesmo
            critério dos laboratórios; mestrado e doutorado 3,75. Curso de agropecuária ganha um bônus de 50% sobre o peso (já incluído aqui).
          </Termo>
          <Termo nome="CH mínima MEC">
            A carga horária mínima que o MEC define para o curso, nos catálogos nacionais (técnicos e tecnologia) e nas diretrizes curriculares (graduação). É o piso: o curso pode ter mais horas,
            mas a matriz não paga o que passa do limite abaixo.
          </Termo>
          <Termo nome="CH que vale">
            A carga horária que a matriz aceita contar. Para a maioria dos cursos é a mínima do MEC. No ensino médio integrado é 3.000, 3.100 ou 3.200 horas conforme a mínima do eixo; no Proeja,
            2.400 horas; em qualificação profissional (FIC) e doutorado vale a carga horária do próprio ciclo (aqui aparece a mínima, como aproximação).
          </Termo>
          <Termo nome="Matrículas por aluno">
            Peso multiplicado pela carga horária que vale e dividido por 800 (a carga horária de referência por ano). É o quanto o aluno rende na conta da matriz, ao longo do curso inteiro.
          </Termo>
          <Termo nome="R$ por aluno, curso inteiro">
            As matrículas por aluno vezes o valor de uma matrícula. É o que a MDO paga, em média, por um aluno que faz o curso do início ao fim. Não depende da duração: um curso de 3 e um de 4 anos
            com a mesma carga horária rendem o mesmo por aluno, e o mais curto rende mais depressa. Informe a duração para ver o valor por ano.
          </Termo>
          <Termo nome="Cuidado">
            Este é um valor de referência, não o que o câmpus recebe. O aluno que evade deixa de contar, o valor de uma matrícula muda a cada ciclo (depende do orçamento total e das matrículas de toda
            a Rede), e a matriz só repassa depois de somar todos os cursos e aplicar o Piso Mínimo e os demais blocos. Para simular um curso novo ano a ano, com evasão, use{" "}
            <Link href="/simulador/novo-curso" className={PROSE_LINK}>
              Abrir um curso novo
            </Link>{" "}
            ou{" "}
            <Link href="/simulador/curso" className={PROSE_LINK}>
              Curso de 3 ou 4 anos
            </Link>
            . Para o valor real de cada curso de um câmpus, veja{" "}
            <Link href="/consulta/valor-do-aluno" className={PROSE_LINK}>
              Quanto vale um aluno
            </Link>
            .
          </Termo>
        </dl>
      </details>
    </main>
  );
}

function Termo({ nome, children }: { nome: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-medium text-neutral-900 dark:text-neutral-100">{nome}</dt>
      <dd className="text-neutral-600 dark:text-neutral-400">{children}</dd>
    </div>
  );
}
