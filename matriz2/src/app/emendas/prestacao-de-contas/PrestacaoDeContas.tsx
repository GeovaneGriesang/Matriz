"use client";

import { Fragment, useMemo, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { ehCampusDestaque } from "@/lib/destaque";

export interface LinhaExecutada {
  ano: number;
  codigo: string;
  anoEmenda: number;
  autor: string;
  partido: string | null;
  uf: string | null;
  ementa: string | null;
  campus: string;
  acao: string;
  acaoNome: string;
  gnd: string;
  empenhado: number;
  liquidado: number;
  pago: number;
  rapPago: number;
}

type Aba = "ano" | "campus" | "autor" | "emenda";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inteiro = new Intl.NumberFormat("pt-BR");
const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums";
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";
const GND: Record<string, string> = { "3": "custeio", "4": "investimento" };
const botao = (ativo: boolean) =>
  `rounded px-3 py-1.5 text-sm font-medium ${ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`;
const seletor = "rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";

const totalPago = (l: LinhaExecutada) => l.pago + l.rapPago;

interface Grupo {
  chave: string;
  rotulo: string;
  linhas: LinhaExecutada[];
  empenhado: number;
  pago: number;
  rapPago: number;
  emendas: number;
  extra: string;
}

function agrupar(linhas: LinhaExecutada[], chave: (l: LinhaExecutada) => string, extra: (ls: LinhaExecutada[]) => string): Grupo[] {
  const m = new Map<string, LinhaExecutada[]>();
  for (const l of linhas) m.set(chave(l), [...(m.get(chave(l)) ?? []), l]);
  return [...m.entries()].map(([k, ls]) => ({
    chave: k,
    rotulo: k,
    linhas: ls,
    empenhado: ls.reduce((s, l) => s + l.empenhado, 0),
    pago: ls.reduce((s, l) => s + l.pago, 0),
    rapPago: ls.reduce((s, l) => s + l.rapPago, 0),
    emendas: new Set(ls.map((l) => l.codigo)).size,
    extra: extra(ls),
  }));
}

const lista = (v: string[], max = 3) => {
  const u = [...new Set(v)];
  return u.slice(0, max).join(", ") + (u.length > max ? ` e mais ${u.length - max}` : "");
};

export function PrestacaoDeContas({ linhas }: { linhas: LinhaExecutada[] }) {
  const anos = useMemo(() => [...new Set(linhas.map((l) => l.ano))].sort((a, b) => a - b), [linhas]);
  const campi = useMemo(() => [...new Set(linhas.map((l) => l.campus))].sort((a, b) => Number(ehCampusDestaque(b)) - Number(ehCampusDestaque(a)) || a.localeCompare(b, "pt-BR")), [linhas]);
  const autores = useMemo(() => [...new Set(linhas.map((l) => l.autor))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const [campus, setCampus] = useState("");
  const [autor, setAutor] = useState("");
  const [de, setDe] = useState(anos[0]!);
  const [ate, setAte] = useState(anos[anos.length - 1]!);
  const [aba, setAba] = useState<Aba>("ano");
  const [aberto, setAberto] = useState<string | null>(null);

  const filtradas = useMemo(
    () => linhas.filter((l) => (!campus || l.campus === campus) && (!autor || l.autor === autor) && l.ano >= de && l.ano <= ate),
    [linhas, campus, autor, de, ate],
  );
  const soma = (f: (l: LinhaExecutada) => number) => filtradas.reduce((s, l) => s + f(l), 0);
  const pagoTotal = soma(totalPago);

  const grupos = useMemo(() => {
    if (aba === "ano") return agrupar(filtradas, (l) => String(l.ano), (ls) => lista(ls.map((l) => l.campus))).sort((a, b) => Number(a.chave) - Number(b.chave));
    if (aba === "campus") return agrupar(filtradas, (l) => l.campus, (ls) => lista(ls.map((l) => l.autor))).sort((a, b) => b.pago + b.rapPago - (a.pago + a.rapPago));
    if (aba === "autor") return agrupar(filtradas, (l) => l.autor, (ls) => lista(ls.map((l) => l.campus))).sort((a, b) => b.pago + b.rapPago - (a.pago + a.rapPago));
    return agrupar(filtradas, (l) => l.codigo, (ls) => `${ls[0]!.autor} · ${lista(ls.map((l) => l.campus))}`).sort((a, b) => b.chave.localeCompare(a.chave));
  }, [filtradas, aba]);

  const nomeDaColuna = { ano: "Ano", campus: "Câmpus", autor: "Quem destinou", emenda: "Emenda" }[aba];
  const nomeDoExtra = { ano: "Câmpus", campus: "Quem destinou", autor: "Câmpus", emenda: "Autor e câmpus" }[aba];
  const exemplo = grupos[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Câmpus
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className={seletor}>
            <option value="">Todos</option>
            {campi.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Quem destinou
          <select value={autor} onChange={(e) => setAutor(e.target.value)} className={seletor}>
            <option value="">Todos</option>
            {autores.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          De
          <select value={de} onChange={(e) => setDe(Number(e.target.value))} className={seletor}>
            {anos.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Até
          <select value={ate} onChange={(e) => setAte(Number(e.target.value))} className={seletor}>
            {anos.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        {(campus || autor || de !== anos[0] || ate !== anos[anos.length - 1]) && (
          <button
            type="button"
            className="text-sm text-if-green underline"
            onClick={() => {
              setCampus("");
              setAutor("");
              setDe(anos[0]!);
              setAte(anos[anos.length - 1]!);
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Cartao titulo="Total pago" valor={reais.format(pagoTotal)} nota={`${reais.format(soma((l) => l.pago))} no próprio ano e ${reais.format(soma((l) => l.rapPago))} em restos a pagar`} />
        <Cartao titulo="Empenhado" valor={reais.format(soma((l) => l.empenhado))} nota="reservado para compras e serviços" />
        <Cartao titulo="Emendas" valor={inteiro.format(new Set(filtradas.map((l) => l.codigo)).size)} nota={`de ${inteiro.format(new Set(filtradas.map((l) => l.autor)).size)} autores`} />
        <Cartao titulo="Câmpus atendidos" valor={inteiro.format(new Set(filtradas.map((l) => l.campus)).size)} nota={`${de} a ${ate}`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ano", "Por ano"],
            ["campus", "Por câmpus"],
            ["autor", "Por quem destinou"],
            ["emenda", "Cada emenda"],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            className={botao(aba === v)}
            onClick={() => {
              setAba(v);
              setAberto(null);
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">{nomeDaColuna}</th>
              <th className="px-2 py-1.5 text-left font-medium">{nomeDoExtra}</th>
              <th className={th}>Emendas</th>
              <th className={th}>Empenhado</th>
              <th className={th}>Pago no ano</th>
              <th className={th}>Restos pagos</th>
              <th className={th}>Total pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {grupos.map((g) => {
              const estaAberto = aberto === g.chave;
              return (
                <Fragment key={g.chave}>
                  <tr className={estaAberto ? "bg-if-green/10" : ehCampusDestaque(g.rotulo) ? "bg-if-green/5" : undefined}>
                    <td className="whitespace-nowrap px-2 py-1">
                      <button type="button" onClick={() => setAberto(estaAberto ? null : g.chave)} aria-expanded={estaAberto} className="inline-flex items-center gap-2 font-medium hover:text-if-green">
                        <SinalMaisMenos aberto={estaAberto} />
                        {g.rotulo}
                      </button>
                    </td>
                    <td className="px-2 py-1 text-neutral-600 dark:text-neutral-400">{g.extra}</td>
                    <td className={td}>{g.emendas}</td>
                    <td className={td}>{reais.format(g.empenhado)}</td>
                    <td className={td}>{reais.format(g.pago)}</td>
                    <td className={td}>{reais.format(g.rapPago)}</td>
                    <td className={`${td} font-medium`}>{reais.format(g.pago + g.rapPago)}</td>
                  </tr>
                  {estaAberto && (
                    <tr data-detalhe="1">
                      <td colSpan={7} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                        <DetalheDoGrupo linhas={g.linhas} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
            <tr>
              <td className="px-2 py-1" colSpan={2}>
                Soma
              </td>
              <td className={td}>{new Set(filtradas.map((l) => l.codigo)).size}</td>
              <td className={td}>{reais.format(soma((l) => l.empenhado))}</td>
              <td className={td}>{reais.format(soma((l) => l.pago))}</td>
              <td className={td}>{reais.format(soma((l) => l.rapPago))}</td>
              <td className={td}>{reais.format(pagoTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {exemplo && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Exemplo: o + de {exemplo.rotulo} abre as {exemplo.emendas} emenda(s) da linha, com o câmpus, a ação e o que foi pago, somando {reais.format(exemplo.pago + exemplo.rapPago)}.
        </p>
      )}
    </div>
  );
}

function DetalheDoGrupo({ linhas }: { linhas: LinhaExecutada[] }) {
  const ordenadas = [...linhas].sort((a, b) => b.ano - a.ano || b.codigo.localeCompare(a.codigo) || a.campus.localeCompare(b.campus, "pt-BR"));
  return (
    <div className="sticky left-0 w-[min(88vw,72rem)] overflow-x-auto rounded-md border-l-4 border-if-green bg-white p-3 dark:bg-neutral-950">
      <table className="min-w-full text-xs">
        <thead className="text-neutral-500">
          <tr>
            <th className="px-2 py-1 text-left font-medium">Ano</th>
            <th className="px-2 py-1 text-left font-medium">Emenda</th>
            <th className="px-2 py-1 text-left font-medium">Quem destinou</th>
            <th className="px-2 py-1 text-left font-medium">Câmpus</th>
            <th className="px-2 py-1 text-left font-medium">Ação</th>
            <th className={th}>Empenhado</th>
            <th className={th}>Pago no ano</th>
            <th className={th}>Restos pagos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {ordenadas.map((l, i) => (
            <tr key={i}>
              <td className="px-2 py-1 tabular-nums">{l.ano}</td>
              <td className="px-2 py-1">
                <span className="font-mono">{l.codigo}</span>
                {l.anoEmenda !== l.ano && <span className="ml-1 text-neutral-500">(do orçamento de {l.anoEmenda})</span>}
                {l.ementa && <div className="whitespace-normal text-neutral-500">{l.ementa}</div>}
              </td>
              <td className="px-2 py-1">
                {l.autor}
                {l.partido && <span className="text-neutral-500"> ({l.partido}/{l.uf})</span>}
              </td>
              <td className="px-2 py-1">{l.campus}</td>
              <td className="whitespace-normal px-2 py-1">
                {l.acao} {l.acaoNome.toLowerCase()} · {GND[l.gnd] ?? `GND ${l.gnd}`}
              </td>
              <td className={td}>{reais.format(l.empenhado)}</td>
              <td className={td}>{reais.format(l.pago)}</td>
              <td className={td}>{reais.format(l.rapPago)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{titulo}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</div>
      <div className="mt-1 text-xs text-neutral-500">{nota}</div>
    </div>
  );
}
