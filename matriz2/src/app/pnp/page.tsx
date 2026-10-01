import Link from "next/link";
import type { NivelPnp, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { PROSE_LINK, TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { EtiquetaProcedencia } from "@/components/Procedencia";
import { PainelConfianca } from "@/components/Confianca";
import { AbasPnp } from "@/components/AbasPnp";

export const dynamic = "force-dynamic";

interface Busca {
  subaba?: string;
  dimensao?: string;
  nivel?: string;
  instituicao?: string;
  campus?: string;
  ano?: string;
  edicao?: string;
}

const LIMITE = 600;
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

const NIVEIS: { valor: NivelPnp; rotulo: string }[] = [
  { valor: "REDE", rotulo: "Rede" },
  { valor: "INSTITUICAO", rotulo: "Instituição" },
  { valor: "CAMPUS", rotulo: "Câmpus" },
];

function formatar(rotulo: string, v: number | string | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  // A PNP entrega percentuais em fração (0,7258 = 72,58%) e os rotula com "%".
  if (rotulo.includes("%")) return percentual.format(v);
  return Number.isInteger(v) ? inteiro.format(v) : decimal.format(v);
}

const selectClasse =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export default async function PnpPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/pnp");
  const params = await searchParams;

  // Uma fonte por subaba: o nome traz "aba / subaba", e assim a lista de subabas não precisa varrer milhões de linhas.
  const todasAsFontes = await prisma.fonteDados.findMany({
    where: {
      origem: "PNP_MANUAL",
      OR: [{ arquivo: { startsWith: "PNP Dados de Ensino: " } }, { arquivo: { startsWith: "PNP Dados de Pessoal: " } }],
    },
    orderBy: { arquivo: "asc" },
  });
  // A PNP revisa os números a cada edição: a de 2026 traz só o ano-base 2024 como foi publicado em 2026, e a de 2027 traz
  // 2017 a 2025 (inclusive um 2024 possivelmente revisado). Cada edição é uma carga separada, e a tela mostra uma por vez
  // para não somar o mesmo ano-base duas vezes.
  const edicoes = [...new Set(todasAsFontes.map((f) => f.cicloOrcamento))].sort((a, b) => b - a);
  const edicao = edicoes.includes(Number(params.edicao)) ? Number(params.edicao) : (edicoes[0] ?? 0);
  const fontes = todasAsFontes.filter((f) => f.cicloOrcamento === edicao);
  const cabecalho = (
    <div className="flex flex-col gap-2">
      <AbasPnp ativa="ensino" />
      <h1 className="pt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Dados da PNP: ensino e pessoal</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        As tabelas dos painéis &quot;Dados de Ensino&quot; e &quot;Dados de Pessoal&quot; da Plataforma Nilo Peçanha, baixadas à mão: matrícula, situação, eficiência,
        evasão, percentuais legais, perfis dos alunos e docentes e técnicos, por rede, instituição e câmpus, com os anos-base de 2017 a 2025. São números
        da PNP, não da MDO: servem para conferir a matriz e para olhar o que a MDO não publica (as outras instituições e todos os
        câmpus, ano a ano).
      </p>
    </div>
  );

  if (fontes.length === 0) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        {cabecalho}
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhuma tabela da PNP carregada. Rode <code>npm run carregar:pnp -- 2027</code>.
        </p>
      </main>
    );
  }

  const subabas = fontes.map((f) => {
    const rotulo = f.arquivo.replace(/^PNP Dados de (Ensino|Pessoal): /, "").replace(/ \(\d+ arquivos?\)$/, "");
    const [aba, subaba] = rotulo.split(" / ");
    return { aba: aba ?? "", subaba: subaba ?? rotulo, rotulo };
  });
  const subaba = subabas.find((s) => s.subaba === params.subaba)?.subaba ?? subabas.find((s) => s.subaba === "Situação de Matrícula")?.subaba ?? subabas[0]!.subaba;

  const dimensoesBrutas = await prisma.pnpFato.groupBy({ by: ["dimensao"], where: { subaba, fonteDados: { cicloOrcamento: edicao } } });
  const dimensoes = dimensoesBrutas.map((d) => d.dimensao).sort((a, b) => a.localeCompare(b));
  const dimensao = dimensoes.includes(params.dimensao ?? "") ? params.dimensao! : "";

  const nivel = (NIVEIS.find((n) => n.valor === params.nivel)?.valor ?? "INSTITUICAO") as NivelPnp;
  // A abertura por nome de curso só existe no nível de câmpus.
  const nivelEfetivo: NivelPnp = dimensao === "Nome do Curso" || dimensao === "Carga Horária" ? "CAMPUS" : nivel;

  const instituicoes = await prisma.pnpEstrutura.findMany({
    where: { nivel: "INSTITUICAO" },
    orderBy: { instituicao: "asc" },
    select: { instituicao: true },
  });
  const siglaInstituicao = instituicoes.find((i) => i.instituicao === params.instituicao)?.instituicao ?? (instituicoes.find((i) => i.instituicao === "IFSUL")?.instituicao ?? "");

  const campi =
    nivelEfetivo === "CAMPUS" && siglaInstituicao
      ? await prisma.pnpEstrutura.findMany({
          where: { nivel: "CAMPUS", instituicao: siglaInstituicao },
          orderBy: { campus: "asc" },
          select: { id: true, campus: true },
        })
      : [];
  const campusId = campi.find((c) => String(c.id) === params.campus)?.id ?? null;

  // A edição mais recente traz toda a série; as anteriores, só o ano-base que lhes corresponde (ciclo menos 2).
  const anos = edicao === edicoes[0] ? [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017] : [edicao - 2];
  const ano = anos.includes(Number(params.ano)) ? Number(params.ano) : anos[0]!;

  const estruturaFiltro: Prisma.PnpEstruturaWhereInput =
    nivelEfetivo === "REDE"
      ? { nivel: "REDE" }
      : nivelEfetivo === "INSTITUICAO"
        ? { nivel: "INSTITUICAO", instituicao: siglaInstituicao || undefined }
        : { nivel: "CAMPUS", instituicao: siglaInstituicao || undefined, id: campusId ?? undefined };
  // No nível de instituição sem escolha clara, mostra todas; em câmpus, as de uma instituição.
  const onde: Prisma.PnpFatoWhereInput = {
    subaba,
    dimensao,
    anoBase: ano,
    fonteDados: { cicloOrcamento: edicao },
    estrutura: nivelEfetivo === "INSTITUICAO" && params.instituicao === "TODAS" ? { nivel: "INSTITUICAO" } : estruturaFiltro,
  };

  const [total, linhas] = await Promise.all([
    prisma.pnpFato.count({ where: onde }),
    prisma.pnpFato.findMany({
      where: onde,
      take: LIMITE,
      orderBy: [{ estruturaId: "asc" }, { valorDimensao: "asc" }, { categoria: "asc" }],
      include: { estrutura: { select: { nivel: true, instituicao: true, campus: true, municipio: true, estado: true } } },
    }),
  ]);

  const rotulosMetricas: string[] = [];
  for (const l of linhas) {
    for (const k of Object.keys(l.valores as Record<string, unknown>)) if (!rotulosMetricas.includes(k)) rotulosMetricas.push(k);
  }
  const temCategoria = linhas.some((l) => l.categoria);

  const fonteDoGrupo = fontes.find((f) => f.arquivo.includes(` / ${subaba} (`));

  function href(m: Partial<Busca>) {
    const q = new URLSearchParams();
    const atual: Busca = { subaba, dimensao, nivel: nivelEfetivo, instituicao: params.instituicao ?? siglaInstituicao, ano: String(ano), edicao: String(edicao), ...m };
    for (const [k, v] of Object.entries(atual)) if (v) q.set(k, v);
    return `/pnp?${q.toString()}`;
  }

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      {cabecalho}
      <PainelConfianca ids={["pnp-manual-confere", "pnp-indicador-diferente-mdo"]} />

      <form method="get" className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tabela</span>
          <select name="subaba" defaultValue={subaba} className={selectClasse}>
            {subabas.map((s) => (
              <option key={s.rotulo} value={s.subaba}>
                {s.aba}: {s.subaba}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Detalhar por</span>
          <select name="dimensao" defaultValue={dimensao} className={selectClasse}>
            <option value="">Sem detalhamento</option>
            {dimensoes
              .filter((d) => d !== "")
              .map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Nível</span>
          <select name="nivel" defaultValue={nivelEfetivo} className={selectClasse}>
            {NIVEIS.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          <select name="instituicao" defaultValue={params.instituicao === "TODAS" ? "TODAS" : siglaInstituicao} className={selectClasse}>
            <option value="TODAS">Todas (nível instituição)</option>
            {instituicoes.map((i) => (
              <option key={i.instituicao} value={i.instituicao}>
                {i.instituicao}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" title="A PNP revisa os números a cada edição. A edição 2026 traz só o ano-base 2024, como publicado em 2026; a 2027 traz 2017 a 2025.">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Edição da PNP</span>
          <select name="edicao" defaultValue={String(edicao)} className={selectClasse}>
            {edicoes.map((e) => (
              <option key={e} value={e}>
                {e} (ano-base {e === edicoes[0] ? "2017 a 2025" : e - 2})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ano-base</span>
          <select name="ano" defaultValue={String(ano)} className={selectClasse}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {nivelEfetivo === "CAMPUS" && campi.length > 0 && (
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Câmpus</span>
            <select name="campus" defaultValue={campusId ? String(campusId) : ""} className={selectClasse}>
              <option value="">Todos os câmpus da instituição</option>
              {campi.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.campus}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end lg:col-span-1">
          <button type="submit" className="w-full rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90">
            Mostrar
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        {fonteDoGrupo && (
          <EtiquetaProcedencia
            fonte={{
              origem: fonteDoGrupo.origem,
              fase: fonteDoGrupo.fase,
              arquivo: fonteDoGrupo.arquivo,
              geradoEm: fonteDoGrupo.geradoEm,
              carregadoEm: fonteDoGrupo.carregadoEm,
              abrangencia: fonteDoGrupo.abrangencia,
              ressalva: fonteDoGrupo.ressalva,
            }}
          />
        )}
        <span>
          {inteiro.format(total)} linha(s)
          {total > LIMITE ? `, mostrando as ${LIMITE} primeiras: use os filtros de instituição e câmpus` : ""}. Para ver a mesma tabela em outro ano,{" "}
          <Link href={href({ ano: String(ano === 2025 ? 2024 : 2025) })} className={PROSE_LINK}>
            troque o ano-base
          </Link>
          .
        </span>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhuma linha para esse recorte. Nem toda tabela existe em todos os níveis (o nome do curso só existe por câmpus, por exemplo).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2">Estrutura</th>
                {dimensao && <th className="px-3 py-2">{dimensao}</th>}
                {temCategoria && <th className="px-3 py-2">Categoria</th>}
                {rotulosMetricas.map((r) => (
                  <th key={r} className="px-3 py-2 text-right">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {linhas.map((l) => {
                const v = l.valores as Record<string, number | string>;
                const e = l.estrutura;
                return (
                  <tr key={String(l.id)}>
                    <td className="px-3 py-1.5 font-medium text-neutral-900 dark:text-neutral-100">
                      {e.nivel === "REDE" ? "Rede" : e.nivel === "INSTITUICAO" ? e.instituicao : `${e.instituicao}, ${e.campus}`}
                    </td>
                    {dimensao && <td className="px-3 py-1.5">{l.valorDimensao}</td>}
                    {temCategoria && <td className="px-3 py-1.5 text-neutral-600 dark:text-neutral-400">{l.categoria}</td>}
                    {rotulosMetricas.map((r) => (
                      <td key={r} className="px-3 py-1.5 text-right tabular-nums">
                        {formatar(r, v[r])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
