import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { PainelConfianca } from "@/components/Confianca";

export const dynamic = "force-dynamic";

interface Busca {
  ano?: string;
  tipo?: string;
  q?: string;
  so?: string;
}

const LIMITE = 400;
const inteiro = new Intl.NumberFormat("pt-BR");
const peso = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

const selectClasse =
  "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export default async function PesoEfetivoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/peso-efetivo");
  const busca = await searchParams;

  const anos = await prisma.pesoEfetivoCurso.groupBy({ by: ["anoReferencia"], orderBy: { anoReferencia: "desc" } });
  const ano = Number(busca.ano) || anos[0]?.anoReferencia;

  if (!ano) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-4 px-6 py-12 lg:px-12`}>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Peso efetivo por curso</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A tabela ainda não foi montada. Rode <code>npm run carregar:peso-efetivo -- 2027</code> depois de carregar a 6ª fase.
        </p>
      </main>
    );
  }

  const tipos = await prisma.pesoEfetivoCurso.groupBy({ by: ["tipoCurso"], where: { anoReferencia: ano }, orderBy: { tipoCurso: "asc" } });
  const where: Prisma.PesoEfetivoCursoWhereInput = { anoReferencia: ano };
  if (busca.tipo) where.tipoCurso = busca.tipo;
  if (busca.q) where.curso = { contains: busca.q };

  const [linhas, total, divergentes, regra] = await Promise.all([
    prisma.pesoEfetivoCurso.findMany({ where, orderBy: [{ ciclosObservados: "desc" }, { curso: "asc" }], take: LIMITE }),
    prisma.pesoEfetivoCurso.count({ where }),
    prisma.pesoEfetivoCurso.count({ where: { anoReferencia: ano, origem: "DEDUZIDO_DA_MATRICULA_TOTAL" } }),
    prisma.pesoEfetivoCurso.findFirst({ where: { anoReferencia: ano, origem: "REGRA_FIC_SEM_CATALOGO" } }),
  ]);

  // Quantas linhas têm o peso efetivo diferente da coluna "Peso do Curso" (sem contar o bônus de 50% da agropecuária).
  const todas = await prisma.pesoEfetivoCurso.findMany({
    where: { anoReferencia: ano, origem: "DEDUZIDO_DA_MATRICULA_TOTAL" },
    select: { pesoEfetivo: true, pesoColuna: true, ciclosObservados: true },
  });
  const difere = todas.filter((l) => {
    const e = Number(l.pesoEfetivo);
    const c = Number(l.pesoColuna);
    return Math.abs(e - c) > 0.001 && Math.abs(e - c * 1.5) > 0.001;
  });
  const ciclosDifere = difere.reduce((s, l) => s + l.ciclosObservados, 0);
  const ciclosTotal = todas.reduce((s, l) => s + l.ciclosObservados, 0);

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Peso efetivo por curso</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          A MDO multiplica a matrícula de cada ciclo por um peso que depende do curso. A exportação tem uma coluna "Peso do Curso",
          mas ela nem sempre é o peso que de fato entrou na conta. O <strong>peso efetivo</strong> é o que a MDO aplicou, já com o
          bônus de 50% da agropecuária, descoberto de trás para frente a partir da Matrícula Total publicada. Esta tabela guarda
          esse peso para cada combinação de tipo de curso, oferta, curso e carga horária mínima do MEC, com a fonte de cada linha.
        </p>
      </div>

      <PainelConfianca ids={["peso-efetivo-tabela"]} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{inteiro.format(divergentes)}</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">combinações curso e carga horária na tabela de {ano}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {ciclosTotal > 0 ? ((ciclosDifere / ciclosTotal) * 100).toFixed(1).replace(".", ",") : "0"}%
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            dos {inteiro.format(ciclosTotal)} ciclos têm peso efetivo diferente da coluna "Peso do Curso" (sem contar a agropecuária)
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{regra ? peso.format(Number(regra.pesoEfetivo)) : "-"}</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            peso do FIC fora do catálogo (carga horária mínima padrão de 3.200 h)
            {regra ? `, em ${inteiro.format(regra.ciclosObservados)} ciclos` : ""}
          </p>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          Ano de referência
          <select name="ano" defaultValue={String(ano)} className={selectClasse}>
            {anos.map((a) => (
              <option key={a.anoReferencia} value={a.anoReferencia}>
                {a.anoReferencia}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          Tipo de curso
          <select name="tipo" defaultValue={busca.tipo ?? ""} className={selectClasse}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.tipoCurso} value={t.tipoCurso}>
                {t.tipoCurso}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          Nome do curso contém
          <input name="q" defaultValue={busca.q ?? ""} className={selectClasse} placeholder="ex.: INFORMATICA" />
        </label>
        <button type="submit" className="rounded-md bg-if-green px-3 py-1.5 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      <p className="text-xs text-neutral-500">
        {inteiro.format(total)} linhas{total > LIMITE ? `; mostrando as ${LIMITE} com mais ciclos, refine o filtro para ver as demais` : ""}.
        Fonte de todas as linhas: 6ª fase da MDO, rede sem o IFSul. Veja também a{" "}
        <Link href="/situacao-dos-dados" className={PROSE_LINK}>
          situação dos dados
        </Link>
        .
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">Tipo de curso</th>
              <th className="px-3 py-2">Oferta</th>
              <th className="px-3 py-2">Curso</th>
              <th className="px-3 py-2 text-right">CH mínima MEC</th>
              <th className="px-3 py-2 text-right">Peso efetivo</th>
              <th className="px-3 py-2 text-right">Coluna "Peso do Curso"</th>
              <th className="px-3 py-2 text-right">Ciclos</th>
              <th className="px-3 py-2">Fonte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {linhas.map((l) => {
              const e = Number(l.pesoEfetivo);
              const c = Number(l.pesoColuna);
              const diferente = Math.abs(e - c) > 0.001 && Math.abs(e - c * 1.5) > 0.001;
              return (
                <tr key={l.id} className="align-top">
                  <td className="px-3 py-2">{l.tipoCurso}</td>
                  <td className="px-3 py-2">{l.tipoOferta === "*" ? "qualquer" : l.tipoOferta}</td>
                  <td className="px-3 py-2">{l.curso === "*" ? "qualquer curso fora do catálogo" : l.curso}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(l.chMinimaMec)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{peso.format(e)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${diferente ? "font-medium text-amber-700 dark:text-amber-400" : ""}`}>
                    {peso.format(c)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {inteiro.format(l.ciclosConcordantes)} de {inteiro.format(l.ciclosObservados)}
                  </td>
                  <td className="max-w-md px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">{l.fonte}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
