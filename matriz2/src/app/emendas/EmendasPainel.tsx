"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ehInstituicaoDestaque } from "@/lib/destaque";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";

export interface EmendaDoPainel {
  numero: string;
  modalidade: string;
  tipoAutor: string;
  autor: string;
  partidoAutor: string | null;
  ufAutor: string | null;
  ementa: string;
  uoCodigo: string;
  uoNome: string;
  sigla: string | null;
  instituicao: string | null;
  uf: string | null;
  funcional: string;
  acao: string;
  acaoDescricao: string;
  subtitulo: string;
  gnd3: number;
  gnd4: number;
  outros: number;
  total: number;
  comRecibo: boolean | null;
  justificativa: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR");
const umDecimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const REGIAO: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

/** Quem apresentou a emenda, em quatro grupos fáceis de reconhecer. */
type TipoDeAutor = "Deputado federal" | "Senador" | "Bancada estadual" | "Comissão";
function tipoDe(e: EmendaDoPainel): TipoDeAutor {
  if (e.tipoAutor === "Deputado Federal") return "Deputado federal";
  if (e.tipoAutor === "Senador") return "Senador";
  if (e.tipoAutor === "Bancada Estadual") return "Bancada estadual";
  return "Comissão";
}
const TIPOS: TipoDeAutor[] = ["Deputado federal", "Senador", "Bancada estadual", "Comissão"];

type Escopo = "diretas" | "mec" | "todas";
type Visao = "geral" | "autores" | "instituicoes" | "lista";
type Gnd = "" | "3" | "4" | "misto";
type Recibo = "" | "sim" | "nao" | "coletiva";
type Faixa = "" | "simbolico" | "ate500" | "ate2mi" | "acima2mi";

interface Filtros {
  busca: string;
  tipos: TipoDeAutor[];
  partido: string;
  ufAutor: string;
  autor: string;
  regiao: string;
  uf: string;
  sigla: string;
  acao: string;
  gnd: Gnd;
  recibo: Recibo;
  faixa: Faixa;
}

const SEM_FILTRO: Filtros = { busca: "", tipos: [], partido: "", ufAutor: "", autor: "", regiao: "", uf: "", sigla: "", acao: "", gnd: "", recibo: "", faixa: "" };

const ROTULO_GND: Record<Exclude<Gnd, "">, string> = { "3": "Custeio (GND 3)", "4": "Investimento (GND 4)", misto: "Custeio e investimento" };
const ROTULO_FAIXA: Record<Exclude<Faixa, "">, string> = { simbolico: "Valor simbólico (até R$ 10)", ate500: "Até R$ 500 mil", ate2mi: "De R$ 500 mil a R$ 2 milhões", acima2mi: "Acima de R$ 2 milhões" };
const ROTULO_FILTRO: Record<keyof Filtros, string> = {
  busca: "Procura",
  tipos: "Quem",
  partido: "Partido",
  ufAutor: "UF do parlamentar",
  autor: "Autor",
  regiao: "Região",
  uf: "UF",
  sigla: "Instituição",
  acao: "Ação",
  gnd: "Grupo",
  recibo: "Recibo",
  faixa: "Valor",
};

function gndDa(e: EmendaDoPainel): Exclude<Gnd, ""> {
  if (e.gnd3 > 0 && e.gnd4 > 0) return "misto";
  return e.gnd4 > 0 ? "4" : "3";
}
function faixaDa(v: number): Exclude<Faixa, ""> {
  if (v <= 10) return "simbolico";
  if (v <= 500_000) return "ate500";
  if (v <= 2_000_000) return "ate2mi";
  return "acima2mi";
}
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
/** Quem recebe: a instituição, ou o MEC quando a emenda ainda não diz qual. */
function quemRecebe(e: EmendaDoPainel): string {
  return e.sigla ?? "MEC, a repartir";
}
/** O autor com partido e UF, como se lê no noticiário: "Bohn Gass (PT/RS)". */
function autorCompleto(e: Pick<EmendaDoPainel, "autor" | "partidoAutor" | "ufAutor">): string {
  const extra = [e.partidoAutor, e.ufAutor].filter(Boolean).join("/");
  return extra ? `${e.autor} (${extra})` : e.autor;
}

// Cores dos gráficos: o verde do IF para o principal e tons que se distinguem bem, no claro e no escuro.
const CORES = ["#2f9e41", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#64748b", "#ec4899"];
const COR_GND3 = "#86cf91";
const COR_GND4 = "#2f9e41";

function Rosca({ fatias, centro, rotuloCentro }: { fatias: { rotulo: string; valor: number; cor: string }[]; centro: string; rotuloCentro: string }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const r = 42;
  const circ = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={fatias.map((f) => `${f.rotulo}: ${reais.format(f.valor)}`).join("; ")}>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="16" className="stroke-neutral-100 dark:stroke-neutral-800" />
        {total > 0 &&
          fatias.map((f) => {
            const parte = (f.valor / total) * circ;
            const el = (
              <circle
                key={f.rotulo}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={f.cor}
                strokeWidth="16"
                strokeDasharray={`${parte} ${circ - parte}`}
                strokeDashoffset={-acumulado}
                transform="rotate(-90 60 60)"
              >
                <title>{`${f.rotulo}: ${reais.format(f.valor)}`}</title>
              </circle>
            );
            acumulado += parte;
            return el;
          })}
        <text x="60" y="58" textAnchor="middle" className="fill-neutral-900 text-[13px] font-semibold dark:fill-neutral-100">
          {centro}
        </text>
        <text x="60" y="74" textAnchor="middle" className="fill-neutral-500 text-[9px]">
          {rotuloCentro}
        </text>
      </svg>
      <ul className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />
              {f.rotulo}
            </span>
            <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
              {compacto.format(f.valor)} · {total > 0 ? umDecimal.format((f.valor / total) * 100) : "0"}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Quadro({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h3>
        {nota ? <p className="text-xs text-neutral-500">{nota}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Barras({
  itens,
  ativo,
  aoClicar,
}: {
  itens: { chave: string; rotulo: string; detalhe?: string; g3: number; g4: number; destaque?: boolean }[];
  ativo: string;
  aoClicar: (chave: string) => void;
}) {
  const max = Math.max(1, ...itens.map((i) => i.g3 + i.g4));
  if (itens.length === 0) return <p className="text-sm text-neutral-500">Nenhuma emenda com estes filtros.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {itens.map((i) => (
        <li key={i.chave}>
          <button
            type="button"
            onClick={() => aoClicar(i.chave)}
            title={`${i.rotulo}: ${reais.format(i.g3 + i.g4)} (${reais.format(i.g4)} investimento, ${reais.format(i.g3)} custeio). Clique para filtrar.`}
            className={`grid w-full grid-cols-[minmax(5rem,9rem)_1fr_4.5rem] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
              ativo === i.chave ? "bg-if-green/10 ring-1 ring-if-green/40" : ""
            } ${i.destaque ? "font-semibold text-if-green" : "text-neutral-700 dark:text-neutral-300"}`}
          >
            <span className="truncate">
              {i.rotulo}
              {i.detalhe ? <span className="block truncate text-[10px] font-normal text-neutral-500">{i.detalhe}</span> : null}
            </span>
            <span className="flex h-3.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              <span style={{ width: `${(i.g4 / max) * 100}%`, background: COR_GND4 }} />
              <span style={{ width: `${(i.g3 / max) * 100}%`, background: COR_GND3 }} />
            </span>
            <span className="text-right tabular-nums">{compacto.format(i.g3 + i.g4)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Cartao({ titulo, valor, detalhe, destaque, children }: { titulo: string; valor: string; detalhe: ReactNode; destaque?: boolean; children?: ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border p-4 shadow-sm ${
        destaque ? "border-if-green/50 bg-if-green/5" : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{titulo}</span>
      <span className={`text-2xl font-semibold tabular-nums ${destaque ? "text-if-green" : "text-neutral-900 dark:text-neutral-100"}`}>{valor}</span>
      <span className="text-xs text-neutral-600 dark:text-neutral-400">{detalhe}</span>
      {children}
    </div>
  );
}

function Seletor({ rotulo, valor, aoMudar, opcoes, todos = "Todos" }: { rotulo: string; valor: string; aoMudar: (v: string) => void; opcoes: { valor: string; rotulo: string }[]; todos?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
      {rotulo}
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={`rounded-md border px-2 py-1.5 text-sm dark:bg-neutral-900 ${valor ? "border-if-green bg-if-green/5 text-neutral-900 dark:text-neutral-100" : "border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"}`}
      >
        <option value="">{todos}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetalheDaEmenda({ e }: { e: EmendaDoPainel }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm text-neutral-700 sm:grid-cols-[10rem_1fr] dark:text-neutral-300">
      <dt className="font-medium text-neutral-500">Autor</dt>
      <dd>
        {autorCompleto(e)}, {e.tipoAutor.toLowerCase()}. Emenda {e.modalidade.toLowerCase()}
        {e.comRecibo === true ? ", com recibo de entrega" : e.comRecibo === false ? ", sem recibo de entrega" : ""}.
      </dd>
      <dt className="font-medium text-neutral-500">Ementa</dt>
      <dd>{e.ementa || "-"}</dd>
      <dt className="font-medium text-neutral-500">Para</dt>
      <dd>
        {e.uoCodigo} - {e.uoNome}. Subtítulo: {e.subtitulo}.
      </dd>
      <dt className="font-medium text-neutral-500">Ação</dt>
      <dd>
        {e.acao} - {e.acaoDescricao} <span className="font-mono text-xs text-neutral-500">({e.funcional || "sem funcional"})</span>
      </dd>
      <dt className="font-medium text-neutral-500">Valor</dt>
      <dd>
        {reais.format(e.total)}: {reais.format(e.gnd4)} em investimento e {reais.format(e.gnd3)} em custeio{e.outros > 0 ? `, mais ${reais.format(e.outros)} em outros grupos` : ""}.
      </dd>
      <dt className="font-medium text-neutral-500">Justificativa</dt>
      <dd className="whitespace-pre-line">{e.justificativa || "sem justificativa no espelho"}</dd>
    </dl>
  );
}

export function EmendasPainel({ emendas, exercicio }: { emendas: EmendaDoPainel[]; exercicio: number }) {
  const [escopo, setEscopo] = useState<Escopo>("diretas");
  const [visao, setVisao] = useState<Visao>("geral");
  const [f, setF] = useState<Filtros>(SEM_FILTRO);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [verTodas, setVerTodas] = useState(false);
  const [maisFiltros, setMaisFiltros] = useState(false);

  const mudar = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((a) => ({ ...a, [k]: v }));
  const alternar = (k: string) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const alternarTipo = (t: TipoDeAutor) => setF((a) => ({ ...a, tipos: a.tipos.includes(t) ? a.tipos.filter((x) => x !== t) : [...a.tipos, t] }));

  const doEscopo = useMemo(() => emendas.filter((e) => (escopo === "todas" ? true : escopo === "mec" ? e.uoCodigo === "26101" : e.uoCodigo !== "26101")), [emendas, escopo]);

  const passa = (e: EmendaDoPainel, ignorar?: keyof Filtros) => {
    const ok = (k: keyof Filtros, cond: boolean) => ignorar === k || cond;
    const busca = semAcento(f.busca.trim());
    return (
      ok("busca", !busca || semAcento([e.numero, e.autor, e.partidoAutor ?? "", e.sigla ?? "", e.instituicao ?? "", e.acao, e.ementa, e.subtitulo, e.justificativa].join(" ")).includes(busca)) &&
      ok("tipos", f.tipos.length === 0 || f.tipos.includes(tipoDe(e))) &&
      ok("partido", !f.partido || e.partidoAutor === f.partido) &&
      ok("ufAutor", !f.ufAutor || e.ufAutor === f.ufAutor) &&
      ok("autor", !f.autor || e.autor === f.autor) &&
      ok("regiao", !f.regiao || (e.uf !== null && REGIAO[e.uf] === f.regiao)) &&
      ok("uf", !f.uf || e.uf === f.uf) &&
      ok("sigla", !f.sigla || quemRecebe(e) === f.sigla) &&
      ok("acao", !f.acao || e.acao === f.acao) &&
      ok("gnd", !f.gnd || gndDa(e) === f.gnd) &&
      ok("recibo", !f.recibo || (f.recibo === "coletiva" ? e.comRecibo === null : f.recibo === "sim" ? e.comRecibo === true : e.comRecibo === false)) &&
      ok("faixa", !f.faixa || faixaDa(e.total) === f.faixa)
    );
  };

  const filtradas = doEscopo.filter((e) => passa(e));
  const totalEscopo = doEscopo.reduce((s, e) => s + e.total, 0);
  const total = filtradas.reduce((s, e) => s + e.total, 0);
  const gnd3 = filtradas.reduce((s, e) => s + e.gnd3, 0);
  const gnd4 = filtradas.reduce((s, e) => s + e.gnd4, 0);
  const instituicoesNoFiltro = new Set(filtradas.filter((e) => e.sigla).map((e) => e.sigla));
  const autoresNoFiltro = new Set(filtradas.map((e) => e.autor));
  const ativos = (Object.keys(f) as (keyof Filtros)[]).filter((k) => (Array.isArray(f[k]) ? (f[k] as unknown[]).length > 0 : f[k] !== ""));

  // As opções de cada seletor vêm do grupo de emendas inteiro, para nenhuma sumir quando outro filtro está ligado.
  const opcoes = (valor: (e: EmendaDoPainel) => string | null, rotulo?: (v: string) => string) =>
    [...new Set(doEscopo.map(valor).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "pt-BR")).map((v) => ({ valor: v, rotulo: rotulo ? rotulo(v) : v }));
  const contagem = (valor: (e: EmendaDoPainel) => string | null) => {
    const m = new Map<string, number>();
    for (const e of doEscopo) {
      const v = valor(e);
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  };
  const porTipo = contagem(tipoDe);

  // Por instituição, com os filtros de agora menos o de instituição: a posição do IFSul e o resumo.
  const porInstituicao = useMemo(() => {
    const m = new Map<string, { sigla: string; nome: string; uf: string; n: number; individuais: number; coletivas: number; gnd3: number; gnd4: number; total: number; autores: Set<string>; emendas: EmendaDoPainel[] }>();
    for (const e of doEscopo) {
      if (!passa(e, "sigla")) continue;
      const k = quemRecebe(e);
      const l = m.get(k) ?? { sigla: k, nome: e.instituicao ?? "Ministério da Educação, a repartir entre as instituições", uf: e.sigla ? (e.uf ?? "") : "", n: 0, individuais: 0, coletivas: 0, gnd3: 0, gnd4: 0, total: 0, autores: new Set<string>(), emendas: [] };
      l.n++;
      if (e.modalidade === "Individual") l.individuais++;
      else l.coletivas++;
      l.gnd3 += e.gnd3;
      l.gnd4 += e.gnd4;
      l.total += e.total;
      l.autores.add(e.autor);
      l.emendas.push(e);
      m.set(k, l);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doEscopo, f]);
  const soInstituicoes = porInstituicao.filter((l) => l.sigla !== "MEC, a repartir");
  const somaSoInstituicoes = soInstituicoes.reduce((s, l) => s + l.total, 0);
  const posIfsul = soInstituicoes.findIndex((l) => ehInstituicaoDestaque(l.sigla));
  const ifsul = posIfsul >= 0 ? soInstituicoes[posIfsul] : undefined;

  // Por autor, com os filtros de agora.
  const porAutor = useMemo(() => {
    const m = new Map<string, { autor: string; tipo: TipoDeAutor; partido: string | null; uf: string | null; n: number; total: number; gnd3: number; gnd4: number; instituicoes: Set<string>; ifsul: number; emendas: EmendaDoPainel[] }>();
    for (const e of filtradas) {
      const l = m.get(e.autor) ?? { autor: e.autor, tipo: tipoDe(e), partido: e.partidoAutor, uf: e.ufAutor, n: 0, total: 0, gnd3: 0, gnd4: 0, instituicoes: new Set<string>(), ifsul: 0, emendas: [] };
      l.n++;
      l.total += e.total;
      l.gnd3 += e.gnd3;
      l.gnd4 += e.gnd4;
      l.instituicoes.add(quemRecebe(e));
      if (e.sigla && ehInstituicaoDestaque(e.sigla)) l.ifsul += e.total;
      l.emendas.push(e);
      m.set(e.autor, l);
    }
    return [...m.values()].sort((a, b) => b.ifsul - a.ifsul || b.total - a.total);
  }, [filtradas]);

  const agrupar = (chave: (e: EmendaDoPainel) => string | null) => {
    const m = new Map<string, { g3: number; g4: number }>();
    for (const e of filtradas) {
      const k = chave(e);
      if (!k) continue;
      const a = m.get(k) ?? { g3: 0, g4: 0 };
      a.g3 += e.gnd3 + e.outros;
      a.g4 += e.gnd4;
      m.set(k, a);
    }
    return [...m.entries()].sort((a, b) => b[1].g3 + b[1].g4 - (a[1].g3 + a[1].g4));
  };

  const ordenadas = [...filtradas].sort((a, b) => {
    const da = a.sigla && ehInstituicaoDestaque(a.sigla) ? 1 : 0;
    const db = b.sigla && ehInstituicaoDestaque(b.sigla) ? 1 : 0;
    return db - da || b.total - a.total;
  });
  const visiveis = verTodas ? ordenadas : ordenadas.slice(0, 50);

  const contagemEscopo = (s: Escopo) => emendas.filter((e) => (s === "todas" ? true : s === "mec" ? e.uoCodigo === "26101" : e.uoCodigo !== "26101")).length;
  const aba = (ativo: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${ativo ? "bg-if-green text-white shadow-sm" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"}`;
  const descreverFiltro = (k: keyof Filtros): string => {
    const v = f[k];
    if (k === "tipos") return (v as TipoDeAutor[]).join(", ");
    if (k === "gnd") return ROTULO_GND[v as Exclude<Gnd, "">];
    if (k === "faixa") return ROTULO_FAIXA[v as Exclude<Faixa, "">];
    if (k === "recibo") return v === "sim" ? "individual com recibo" : v === "nao" ? "individual sem recibo" : "bancada ou comissão";
    return String(v);
  };
  const limpar = (k: keyof Filtros) => setF((a) => ({ ...a, [k]: SEM_FILTRO[k] }));
  const filtrarAutor = (autor: string) => {
    setF((a) => ({ ...a, autor }));
    setVisao("lista");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Quais emendas</span>
        {(
          [
            ["diretas", "Direto às instituições"],
            ["mec", "Pelo MEC, a repartir"],
            ["todas", "Todas"],
          ] as [Escopo, string][]
        ).map(([s, r]) => (
          <button key={s} type="button" onClick={() => setEscopo(s)} className={aba(escopo === s)}>
            {r} <span className="opacity-75">({contagemEscopo(s)})</span>
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Quem destinou</span>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => alternarTipo(t)}
                aria-pressed={f.tipos.includes(t)}
                disabled={!porTipo.get(t)}
                className={`rounded-full border px-3 py-1 text-sm transition disabled:opacity-40 ${
                  f.tipos.includes(t) ? "border-if-green bg-if-green text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-if-green dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                }`}
              >
                {t} <span className="opacity-75">{porTipo.get(t) ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Seletor rotulo="Partido" valor={f.partido} aoMudar={(v) => mudar("partido", v)} opcoes={opcoes((e) => e.partidoAutor, (v) => `${v} (${contagem((e) => e.partidoAutor).get(v)})`)} />
            <Seletor
              rotulo="UF de quem destinou"
              valor={f.ufAutor}
              aoMudar={(v) => mudar("ufAutor", v)}
              opcoes={opcoes((e) => e.ufAutor, (v) => `${v} (${contagem((e) => e.ufAutor).get(v)})`)}
            />
            <Seletor rotulo="Parlamentar, bancada ou comissão" valor={f.autor} aoMudar={(v) => mudar("autor", v)} opcoes={opcoes((e) => e.autor, (v) => autorCompleto(doEscopo.find((e) => e.autor === v)!))} />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Para onde vai</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Seletor rotulo="Instituição" valor={f.sigla} aoMudar={(v) => mudar("sigla", v)} opcoes={opcoes((e) => quemRecebe(e))} todos="Todas" />
            <Seletor rotulo="Região" valor={f.regiao} aoMudar={(v) => mudar("regiao", v)} opcoes={opcoes((e) => (e.uf ? (REGIAO[e.uf] ?? null) : null))} todos="Todas" />
            <Seletor rotulo="UF da instituição" valor={f.uf} aoMudar={(v) => mudar("uf", v)} opcoes={opcoes((e) => e.uf)} todos="Todas" />
            <Seletor
              rotulo="Ação orçamentária"
              valor={f.acao}
              aoMudar={(v) => mudar("acao", v)}
              opcoes={opcoes(
                (e) => e.acao,
                (v) => `${v} - ${doEscopo.find((e) => e.acao === v)?.acaoDescricao.slice(0, 55) ?? ""}`,
              )}
              todos="Todas"
            />
          </div>
        </div>
        {maisFiltros && (
          <div className="grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800">
            <label className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400 sm:col-span-2 lg:col-span-1">
              Procurar palavra (câmpus, objeto, justificativa)
              <input
                value={f.busca}
                onChange={(e) => mudar("busca", e.target.value)}
                placeholder="ex.: laboratório, Venâncio Aires"
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </label>
            <Seletor rotulo="Grupo de despesa" valor={f.gnd} aoMudar={(v) => mudar("gnd", v as Gnd)} opcoes={(["4", "3", "misto"] as const).map((g) => ({ valor: g, rotulo: ROTULO_GND[g] }))} />
            <Seletor rotulo="Faixa de valor" valor={f.faixa} aoMudar={(v) => mudar("faixa", v as Faixa)} opcoes={(["simbolico", "ate500", "ate2mi", "acima2mi"] as const).map((g) => ({ valor: g, rotulo: ROTULO_FAIXA[g] }))} todos="Todas" />
            <Seletor
              rotulo="Recibo de entrega"
              valor={f.recibo}
              aoMudar={(v) => mudar("recibo", v as Recibo)}
              opcoes={[
                { valor: "sim", rotulo: "Individual, com recibo" },
                { valor: "nao", rotulo: "Individual, sem recibo" },
                { valor: "coletiva", rotulo: "Bancada ou comissão" },
              ]}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMaisFiltros((v) => !v)} className="text-sm font-medium text-if-green underline">
            {maisFiltros ? "Menos filtros" : "Mais filtros: palavra, grupo de despesa, valor e recibo"}
          </button>
          {ativos.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-if-green/10 px-2.5 py-0.5 text-xs text-neutral-800 dark:text-neutral-200">
              <span className="text-neutral-500">{ROTULO_FILTRO[k]}:</span> {descreverFiltro(k)}
              <button type="button" onClick={() => limpar(k)} aria-label={`Tirar o filtro ${ROTULO_FILTRO[k]}`} className="ml-0.5 font-bold text-neutral-500 hover:text-if-red">
                ×
              </button>
            </span>
          ))}
          {ativos.length > 0 && (
            <button type="button" onClick={() => setF(SEM_FILTRO)} className="ml-auto rounded-md border border-neutral-300 px-3 py-1 text-xs dark:border-neutral-700">
              Limpar tudo
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          titulo="Valor das emendas"
          valor={reais.format(total)}
          detalhe={ativos.length > 0 ? `${totalEscopo > 0 ? umDecimal.format((total / totalEscopo) * 100) : "0"}% de ${reais.format(totalEscopo)} neste grupo.` : "Todas as emendas deste grupo."}
        >
          <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" title={`${reais.format(gnd4)} em investimento e ${reais.format(gnd3)} em custeio`}>
            <span style={{ width: `${total > 0 ? (gnd4 / total) * 100 : 0}%`, background: COR_GND4 }} />
            <span style={{ width: `${total > 0 ? (gnd3 / total) * 100 : 0}%`, background: COR_GND3 }} />
          </span>
          <span className="text-[11px] text-neutral-500">
            {total > 0 ? `${Math.round((gnd4 / total) * 100)}% investimento, ${Math.round((gnd3 / total) * 100)}% custeio` : ""}
          </span>
        </Cartao>
        <Cartao
          titulo="Emendas"
          valor={inteiro.format(filtradas.length)}
          detalhe={`${filtradas.filter((e) => e.modalidade === "Individual").length} individuais, ${filtradas.filter((e) => e.modalidade !== "Individual").length} de bancada ou comissão.`}
        />
        <Cartao titulo="Quem e para quem" valor={`${autoresNoFiltro.size} autores`} detalhe={`destinaram a ${instituicoesNoFiltro.size} instituições.`} />
        <Cartao
          titulo="IFSul"
          destaque
          valor={ifsul ? reais.format(ifsul.total) : "nenhuma"}
          detalhe={
            ifsul ? (
              <>
                {ifsul.n} emenda(s) de {ifsul.autores.size} autor(es). <strong>{posIfsul + 1}º</strong> entre {soInstituicoes.length} instituições ({umDecimal.format((ifsul.total / Math.max(1, somaSoInstituicoes)) * 100)}% do valor).
              </>
            ) : (
              "Nenhuma emenda do IFSul com estes filtros."
            )
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["geral", "Visão geral"],
            ["autores", "Quem destinou"],
            ["instituicoes", "Para onde foi"],
            ["lista", "Todas as emendas"],
          ] as [Visao, string][]
        ).map(([v, r]) => (
          <button key={v} type="button" onClick={() => setVisao(v)} className={aba(visao === v)}>
            {r}
          </button>
        ))}
      </div>

      {visao === "geral" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Quadro titulo="Para quais instituições" nota="As 12 maiores e o IFSul. Verde escuro: investimento; verde claro: custeio. Clique para filtrar.">
            <Barras
              ativo={f.sigla}
              aoClicar={(k) => mudar("sigla", f.sigla === k ? "" : k)}
              itens={(() => {
                const todas = agrupar((e) => quemRecebe(e));
                const top = todas.slice(0, 12);
                const ifs = todas.find(([k]) => ehInstituicaoDestaque(k));
                if (ifs && !top.includes(ifs)) top.push(ifs);
                return top.map(([k, a]) => ({ chave: k, rotulo: k, g3: a.g3, g4: a.g4, destaque: ehInstituicaoDestaque(k) }));
              })()}
            />
          </Quadro>
          <Quadro titulo="Quem mais destinou" nota="Os 12 autores com maior valor. Clique para ver as emendas de cada um.">
            <Barras
              ativo={f.autor}
              aoClicar={(k) => filtrarAutor(f.autor === k ? "" : k)}
              itens={agrupar((e) => e.autor)
                .slice(0, 12)
                .map(([k, a]) => {
                  const e = filtradas.find((x) => x.autor === k)!;
                  return { chave: k, rotulo: k, detalhe: [tipoDe(e), e.partidoAutor, e.ufAutor].filter(Boolean).join(" · "), g3: a.g3, g4: a.g4 };
                })}
            />
          </Quadro>
          <Quadro titulo="Por tipo de autor" nota="Deputados e senadores apresentam emendas individuais; bancadas e comissões, coletivas.">
            <Rosca
              centro={compacto.format(total)}
              rotuloCentro="reais"
              fatias={TIPOS.map((t, i) => ({ rotulo: t, valor: filtradas.filter((e) => tipoDe(e) === t).reduce((s, e) => s + e.total, 0), cor: CORES[i]! })).filter((x) => x.valor > 0)}
            />
          </Quadro>
          <Quadro titulo="Por partido" nota="Só deputados e senadores: bancadas e comissões não têm partido. Clique para filtrar.">
            <Barras
              ativo={f.partido}
              aoClicar={(k) => mudar("partido", f.partido === k ? "" : k)}
              itens={agrupar((e) => e.partidoAutor)
                .slice(0, 12)
                .map(([k, a]) => ({ chave: k, rotulo: k, detalhe: `${filtradas.filter((e) => e.partidoAutor === k).length} emendas`, g3: a.g3, g4: a.g4 }))}
            />
          </Quadro>
          <Quadro titulo="Investimento ou custeio" nota="Investimento (GND 4) compra equipamento e faz obra; custeio (GND 3) paga o funcionamento.">
            <Rosca
              centro={total > 0 ? `${Math.round((gnd4 / total) * 100)}%` : "-"}
              rotuloCentro="investimento"
              fatias={[
                { rotulo: "Investimento (GND 4)", valor: gnd4, cor: COR_GND4 },
                { rotulo: "Custeio (GND 3)", valor: gnd3, cor: COR_GND3 },
              ].filter((x) => x.valor > 0)}
            />
          </Quadro>
          <Quadro titulo="Por ação orçamentária" nota="20RL é funcionamento (a ação da matriz); 20RG, reestruturação e modernização; 219U e 15R4 vão pelo MEC.">
            <Barras
              ativo={f.acao}
              aoClicar={(k) => mudar("acao", f.acao === k ? "" : k)}
              itens={agrupar((e) => e.acao).map(([k, a]) => ({ chave: k, rotulo: k, detalhe: filtradas.find((e) => e.acao === k)?.acaoDescricao, g3: a.g3, g4: a.g4 }))}
            />
          </Quadro>
          <Quadro titulo="Por UF da instituição" nota="Onde fica a instituição que recebe. Clique para filtrar.">
            <Barras
              ativo={f.uf}
              aoClicar={(k) => mudar("uf", f.uf === k ? "" : k)}
              itens={agrupar((e) => e.uf).map(([k, a]) => ({ chave: k, rotulo: k, detalhe: REGIAO[k], g3: a.g3, g4: a.g4, destaque: k === "RS" }))}
            />
          </Quadro>
          <Quadro titulo="Por UF de quem destinou" nota="De onde é o parlamentar ou a bancada. Mostra, por exemplo, quanto a bancada gaúcha destinou e para onde.">
            <Barras
              ativo={f.ufAutor}
              aoClicar={(k) => mudar("ufAutor", f.ufAutor === k ? "" : k)}
              itens={agrupar((e) => e.ufAutor).map(([k, a]) => ({ chave: k, rotulo: k, detalhe: REGIAO[k], g3: a.g3, g4: a.g4, destaque: k === "RS" }))}
            />
          </Quadro>
        </div>
      )}

      {visao === "autores" && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Cada parlamentar, bancada ou comissão, com o que destinou à rede. Quem destinou ao IFSul vem primeiro. O + abre as emendas logo abaixo da linha.
          </p>
          <div className="tabela-rolavel rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Autor</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Partido</th>
                  <th className="px-3 py-2">UF</th>
                  <th className="px-3 py-2 text-right">Emendas</th>
                  <th className="px-3 py-2">Para</th>
                  <th className="px-3 py-2 text-right">Ao IFSul</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {porAutor.map((a) => {
                  const chave = `autor:${a.autor}`;
                  const aberta = abertas.has(chave);
                  return (
                    <Fragment key={chave}>
                      <tr className={a.ifsul > 0 ? "bg-if-green/10" : ""}>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => alternar(chave)} aria-expanded={aberta} className="flex items-center gap-2 text-left font-medium hover:text-if-green">
                            <SinalMaisMenos aberto={aberta} />
                            {a.autor}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-xs">{a.tipo}</td>
                        <td className="px-3 py-2">{a.partido ?? "-"}</td>
                        <td className="px-3 py-2">{a.uf ?? "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.n}</td>
                        <td className="max-w-64 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">{[...a.instituicoes].join(", ")}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{a.ifsul > 0 ? <strong className="text-if-green">{reais.format(a.ifsul)}</strong> : "-"}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{reais.format(a.total)}</td>
                      </tr>
                      {aberta && (
                        <tr data-detalhe="1">
                          <td colSpan={99} className="bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
                            <ListaCurta emendas={a.emendas} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
                  <td className="px-3 py-2" colSpan={4}>
                    {porAutor.length} autores
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{filtradas.length}</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(porAutor.reduce((s, a) => s + a.ifsul, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {visao === "instituicoes" && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Cada instituição com o número de emendas e o valor, do maior para o menor, com o IFSul primeiro. O + abre as emendas da instituição logo abaixo. &quot;Fatia&quot; é a parte de cada uma no valor
            destinado às instituições com estes filtros.
          </p>
          <div className="tabela-rolavel rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Posição</th>
                  <th className="px-3 py-2">Instituição</th>
                  <th className="px-3 py-2">UF</th>
                  <th className="px-3 py-2 text-right">Emendas</th>
                  <th className="px-3 py-2 text-right">Autores</th>
                  <th className="px-3 py-2 text-right">Investimento</th>
                  <th className="px-3 py-2 text-right">Custeio</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Fatia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {[...porInstituicao.filter((l) => ehInstituicaoDestaque(l.sigla)), ...porInstituicao.filter((l) => !ehInstituicaoDestaque(l.sigla))].map((l) => {
                  const chave = `inst:${l.sigla}`;
                  const aberta = abertas.has(chave);
                  const destaque = ehInstituicaoDestaque(l.sigla);
                  const mec = l.sigla === "MEC, a repartir";
                  const posicao = mec ? null : soInstituicoes.indexOf(l) + 1;
                  return (
                    <Fragment key={chave}>
                      <tr className={destaque ? "bg-if-green/10 font-medium" : mec ? "bg-neutral-50 dark:bg-neutral-900" : ""}>
                        <td className="px-3 py-2 tabular-nums">{posicao ? `${posicao}º` : "-"}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => alternar(chave)} aria-expanded={aberta} className="flex items-start gap-2 text-left hover:text-if-green">
                            <SinalMaisMenos aberto={aberta} />
                            <span>
                              <span className={destaque ? "text-if-green" : "font-medium"}>{l.sigla}</span>
                              <span className="block text-xs font-normal text-neutral-500">{l.nome}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2">{l.uf || "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.n}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.autores.size}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.gnd4)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{reais.format(l.gnd3)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">{reais.format(l.total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{mec ? "-" : `${umDecimal.format((l.total / Math.max(1, somaSoInstituicoes)) * 100)}%`}</td>
                      </tr>
                      {aberta && (
                        <tr data-detalhe="1">
                          <td colSpan={99} className="bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
                            <ListaCurta emendas={l.emendas} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
                  <td className="px-3 py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{porInstituicao.reduce((s, l) => s + l.n, 0)}</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(porInstituicao.reduce((s, l) => s + l.gnd4, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(porInstituicao.reduce((s, l) => s + l.gnd3, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(porInstituicao.reduce((s, l) => s + l.total, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {visao === "lista" && (
        <section className="flex flex-col gap-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {filtradas.length} emenda(s), do maior valor para o menor, com as do IFSul primeiro. O + abre logo abaixo tudo o que o espelho oficial traz: ementa, subtítulo, ação, valor por grupo e
            justificativa.
          </p>
          <div className="tabela-rolavel rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-3 py-2">Emenda</th>
                  <th className="px-3 py-2">Autor</th>
                  <th className="px-3 py-2">Para</th>
                  <th className="px-3 py-2">Ação</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Recibo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {visiveis.map((e) => {
                  const aberta = abertas.has(e.numero);
                  const destaque = !!e.sigla && ehInstituicaoDestaque(e.sigla);
                  return (
                    <Fragment key={e.numero}>
                      <tr className={destaque ? "bg-if-green/10" : ""}>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => alternar(e.numero)} aria-expanded={aberta} className="flex items-center gap-2 font-mono text-xs hover:text-if-green">
                            <SinalMaisMenos aberto={aberta} />
                            {e.numero}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => mudar("autor", e.autor)} className="text-left hover:text-if-green" title="Ver só as emendas deste autor">
                            {e.autor}
                          </button>
                          <span className="block text-xs text-neutral-500">{[tipoDe(e), e.partidoAutor, e.ufAutor].filter(Boolean).join(" · ")}</span>
                        </td>
                        <td className={`px-3 py-2 ${destaque ? "font-semibold text-if-green" : ""}`}>
                          {quemRecebe(e)}
                          <span className="block text-xs font-normal text-neutral-500">{e.uf ?? ""}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs" title={e.acaoDescricao}>
                          {e.acao}
                        </td>
                        <td className="px-3 py-2 text-xs">{ROTULO_GND[gndDa(e)]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {reais.format(e.total)}
                          {e.total <= 10 ? <span className="block text-xs text-amber-700 dark:text-amber-400">valor simbólico</span> : null}
                        </td>
                        <td className="px-3 py-2 text-xs">{e.comRecibo === null ? <span className="text-neutral-400">coletiva</span> : e.comRecibo ? "sim" : <span className="text-if-red">não</span>}</td>
                      </tr>
                      {aberta && (
                        <tr data-detalhe="1">
                          <td colSpan={99} className="bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
                            <DetalheDaEmenda e={e} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
                  <td className="px-3 py-2" colSpan={5}>
                    Total, {filtradas.length} emenda(s)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {ordenadas.length > 50 && (
            <button type="button" onClick={() => setVerTodas((v) => !v)} className="self-start text-sm font-medium text-if-green underline">
              {verTodas ? "Mostrar só as 50 maiores" : `Mostrar as ${ordenadas.length} emendas`}
            </button>
          )}
        </section>
      )}

      <p className="text-xs text-neutral-500">
        Emendas apresentadas ao PLOA {exercicio}. As que vão pelo MEC não têm instituição definida e ficam fora da posição e da fatia de cada instituição. Partido e UF são os de hoje, das listas da
        Câmara e do Senado.
      </p>
    </div>
  );
}

/** As emendas de um autor ou de uma instituição, em lista curta, para o + das tabelas. */
function ListaCurta({ emendas }: { emendas: EmendaDoPainel[] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {[...emendas]
        .sort((a, b) => b.total - a.total)
        .map((e) => (
          <li key={e.numero} className="flex flex-col gap-0.5">
            <span>
              <span className="font-mono text-xs">{e.numero}</span> · {autorCompleto(e)} · para <strong>{quemRecebe(e)}</strong> · {e.acao} · {ROTULO_GND[gndDa(e)]} ·{" "}
              <strong className="tabular-nums">{reais.format(e.total)}</strong>
              {e.comRecibo === false ? <span className="text-if-red"> · sem recibo</span> : null}
            </span>
            <span className="text-xs text-neutral-600 dark:text-neutral-400">
              {e.subtitulo}. {e.ementa}
            </span>
          </li>
        ))}
    </ul>
  );
}
