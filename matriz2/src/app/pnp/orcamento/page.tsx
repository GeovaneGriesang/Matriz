import { destaqueNaFrente } from "@/lib/destaque";
import type { NivelPnp, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { EtiquetaProcedencia } from "@/components/Procedencia";
import { PainelConfianca } from "@/components/Confianca";
import { AbasPnp } from "@/components/AbasPnp";
import { DESCRICAO_RELACAO_ORGAO, GlossarioPnpOrcamento } from "@/components/GlossarioPnp";
import { opcoesDoOrcamento } from "@/server/queries/opcoesPnp";
import { SeletorComExplicacao } from "@/components/SeletorComExplicacao";

export const dynamic = "force-dynamic";

interface Busca {
  subaba?: string;
  dimensao?: string;
  nivel?: string;
  instituicao?: string;
  orgao?: string;
  ano?: string;
  edicao?: string;
  /** "1" quando a pessoa clicou em Mostrar; sem isto a tela abre só com os filtros, sem consultar os dados. */
  mostrar?: string;
}

const LIMITE = 600;
const PREFIXO = "PNP Dados Orçamentários: ";
const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

const NIVEIS: { valor: NivelPnp; rotulo: string }[] = [
  { valor: "REDE", rotulo: "Rede" },
  { valor: "REGIAO", rotulo: "Região" },
  { valor: "ESTADO", rotulo: "Estado" },
  { valor: "INSTITUICAO", rotulo: "Instituição" },
];

/** Valores em reais, exceto razões (em fração) e contagens de matrícula equivalente. */
function formatar(rotulo: string, v: number | string | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (rotulo.includes("vs.") || rotulo.includes("%")) return percentual.format(v);
  if (/matr[ií]cula equivalente/i.test(rotulo) && !/por matr/i.test(rotulo)) return decimal.format(v);
  return reais.format(v);
}

const selectClasse =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export default async function PnpOrcamentoPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requireAcessoPlenoOrRedirect("/pnp/orcamento");
  const params = await searchParams;

  const todasAsFontes = await prisma.fonteDados.findMany({
    where: { origem: "PNP_MANUAL", arquivo: { startsWith: PREFIXO } },
    orderBy: { arquivo: "asc" },
  });
  // Cada edição da PNP é uma carga separada (a de 2026 traz só o ano-base 2024; a de 2027, 2013 a 2025). A tela mostra uma
  // por vez para não somar o mesmo ano-base duas vezes.
  const edicoes = [...new Set(todasAsFontes.map((f) => f.cicloOrcamento))].sort((a, b) => b - a);
  const edicao = edicoes.includes(Number(params.edicao)) ? Number(params.edicao) : (edicoes[0] ?? 0);
  const fontes = todasAsFontes.filter((f) => f.cicloOrcamento === edicao);
  const cabecalho = (
    <div className="flex flex-col gap-2">
      <AbasPnp ativa="orcamento" />
      <h1 className="pt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Dados da PNP: orçamento</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        O painel &quot;Dados Orçamentários&quot; da PNP: dotação, execução, restos a pagar e descentralizações, e os gastos por
        matrícula equivalente, de 2013 a 2025, por instituição, região, estado e rede. Não existe por câmpus. É o orçamento como a
        PNP registra a execução, não a matriz de distribuição da MDO.
      </p>
    </div>
  );
  if (fontes.length === 0) {
    return (
      <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
        {cabecalho}
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhuma tabela orçamentária carregada. Rode <code>npm run carregar:pnp -- 2027</code>.
        </p>
      </main>
    );
  }

  const subabas = fontes.map((f) => {
    const rotulo = f.arquivo.slice(PREFIXO.length).replace(/ \(\d+ arquivos?\)$/, "");
    const [aba, subaba] = rotulo.split(" / ");
    return { aba: aba ?? "", subaba: subaba ?? rotulo, rotulo };
  });
  const subaba =
    subabas.find((s) => s.rotulo === params.subaba)?.rotulo ??
    subabas.find((s) => s.subaba === "Execução do Exercício")?.rotulo ??
    subabas[0]!.rotulo;
  const escolhida = subabas.find((s) => s.rotulo === subaba)!;

  const mostrar = params.mostrar === "1";
  // As aberturas e as relações do órgão vêm de uma tabela pequena (a varredura da tabela de fatos levava de 1 a 9 segundos em produção).
  const { dimensoes, orgaos } = await opcoesDoOrcamento(edicao, escolhida.aba, escolhida.subaba);
  const dimensao = dimensoes.includes(params.dimensao ?? "") ? params.dimensao! : "";

  const orgao = orgaos.includes(params.orgao ?? "") ? params.orgao! : (orgaos.find((o) => o.includes("UO")) ?? orgaos[0] ?? "");

  const nivel = (NIVEIS.find((n) => n.valor === params.nivel)?.valor ?? "INSTITUICAO") as NivelPnp;
  const instituicoes = destaqueNaFrente(await prisma.pnpEstrutura.findMany({ where: { nivel: "INSTITUICAO" }, orderBy: { instituicao: "asc" }, select: { instituicao: true } }), (i) => i.instituicao);
  const sigla = params.instituicao === "TODAS" ? "TODAS" : (instituicoes.find((i) => i.instituicao === params.instituicao)?.instituicao ?? "IFSUL");

  // A edição mais recente traz toda a série; as anteriores, só o ano-base que lhes corresponde (ciclo menos 2).
  const anos = edicao === edicoes[0] ? [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013] : [edicao - 2];
  const ano = anos.includes(Number(params.ano)) ? Number(params.ano) : anos[0]!;

  const onde: Prisma.PnpOrcamentoFatoWhereInput = {
    aba: escolhida.aba,
    subaba: escolhida.subaba,
    dimensao,
    anoBase: ano,
    fonteDados: { cicloOrcamento: edicao },
    ...(orgao ? { relacaoOrgao: orgao } : {}),
    estrutura: nivel === "INSTITUICAO" && sigla !== "TODAS" ? { nivel, instituicao: sigla } : { nivel },
  };
  // Os dados só são consultados depois do clique em "Mostrar": a tela abre na hora e a pessoa escolhe o recorte antes.
  const [total, linhas] = mostrar
    ? await Promise.all([
        prisma.pnpOrcamentoFato.count({ where: onde }),
        prisma.pnpOrcamentoFato.findMany({
          where: onde,
          take: LIMITE,
          orderBy: [{ estruturaId: "asc" }, { mes: "asc" }, { valorDimensao: "asc" }],
          include: { estrutura: { select: { nivel: true, instituicao: true } } },
        }),
      ])
    : [0, []];
  const rotulosMetricas: string[] = [];
  for (const l of linhas) for (const k of Object.keys(l.valores as Record<string, unknown>)) if (!rotulosMetricas.includes(k)) rotulosMetricas.push(k);
  const temMes = linhas.some((l) => l.mes);
  const temTipo = linhas.some((l) => l.tipoValor);
  const fonte = fontes.find((f) => f.arquivo.startsWith(`${PREFIXO}${escolhida.rotulo} (`));

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      {cabecalho}
      <PainelConfianca ids={["pnp-orcamento-por-instituicao"]} />

      <form method="get" className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="mostrar" value="1" />
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tabela</span>
          <select name="subaba" defaultValue={subaba} className={selectClasse}>
            {subabas.map((s) => (
              <option key={s.rotulo} value={s.rotulo}>
                {s.aba === s.subaba ? s.aba : `${s.aba}: ${s.subaba}`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Detalhar por</span>
          <select name="dimensao" defaultValue={dimensao} className={selectClasse}>
            <option value="">Sem detalhamento</option>
            {dimensoes.filter(Boolean).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Nível</span>
          <select name="nivel" defaultValue={nivel} className={selectClasse}>
            {NIVEIS.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
          <select name="instituicao" defaultValue={sigla} className={selectClasse}>
            <option value="TODAS">Todas</option>
            {instituicoes.map((i) => (
              <option key={i.instituicao} value={i.instituicao}>
                {i.instituicao}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" title="A PNP revisa os números a cada edição. A edição 2026 traz só o ano-base 2024, como publicado em 2026; a 2027 traz 2013 a 2025.">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Edição da PNP</span>
          <select name="edicao" defaultValue={String(edicao)} className={selectClasse}>
            {edicoes.map((e) => (
              <option key={e} value={e}>
                {e} (ano-base {e === edicoes[0] ? "2013 a 2025" : e - 2})
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
        {orgaos.length > 0 && (
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Relação do órgão</span>
            <SeletorComExplicacao nome="orgao" opcoes={orgaos} valorInicial={orgao} explicacoes={DESCRICAO_RELACAO_ORGAO} classeDoSelect={selectClasse} />
          </label>
        )}
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90">
            Mostrar
          </button>
        </div>
      </form>

      {!mostrar && (
        <div className="flex flex-col gap-2 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100">
          <p className="font-medium">Escolha o recorte e clique em Mostrar.</p>
          <p>
            Esta tela só busca os dados depois que você escolhe a tabela, a instituição, o ano-base e, se quiser, uma abertura em &quot;Detalhar por&quot; e a relação do órgão.
            O recorte já escolhido é um bom começo: é só clicar em Mostrar. O que cada tabela, cada relação do órgão (UO, UGE, TED) e cada estágio da despesa significam está logo abaixo.
          </p>
        </div>
      )}

      {mostrar && (
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        {fonte && (
          <EtiquetaProcedencia
            fonte={{
              origem: fonte.origem,
              fase: fonte.fase,
              arquivo: fonte.arquivo,
              geradoEm: fonte.geradoEm,
              carregadoEm: fonte.carregadoEm,
              abrangencia: fonte.abrangencia,
              ressalva: fonte.ressalva,
            }}
          />
        )}
        <span>
          {new Intl.NumberFormat("pt-BR").format(total)} linha(s){total > LIMITE ? `, mostrando as ${LIMITE} primeiras: escolha uma instituição` : ""}.
        </span>
      </div>
      )}

      {mostrar && linhas.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Nenhuma linha para esse recorte. Confira o nível: a tabela de gastos por matrícula equivalente existe por região e estado, e as demais só por rede e instituição.
        </p>
      ) : mostrar ? (
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2">Estrutura</th>
                {temMes && <th className="px-3 py-2">Mês</th>}
                {temTipo && <th className="px-3 py-2">Tipo de valor</th>}
                {dimensao && <th className="px-3 py-2">{dimensao}</th>}
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
                return (
                  <tr key={String(l.id)}>
                    <td className="px-3 py-1.5 font-medium text-neutral-900 dark:text-neutral-100">{l.estrutura.nivel === "REDE" ? "Rede" : l.estrutura.instituicao}</td>
                    {temMes && <td className="px-3 py-1.5">{l.mes}</td>}
                    {temTipo && <td className="px-3 py-1.5">{l.tipoValor}</td>}
                    {dimensao && <td className="px-3 py-1.5">{l.valorDimensao}</td>}
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
      ) : null}

      <GlossarioPnpOrcamento aberto={!mostrar} />
    </main>
  );
}
