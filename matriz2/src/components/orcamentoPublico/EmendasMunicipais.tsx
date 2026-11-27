"use client";

import { Fragment, useMemo, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";

export interface EmendaDaTela {
  id: number;
  exercicio: number;
  numero: string;
  tipo: string;
  autor: string;
  partido: string | null;
  partidoInferido: boolean;
  secretaria: string;
  acao: string | null;
  valor: number;
  objeto: string;
  justificativa: string | null;
  situacao: string | null;
  apresentadaEm: string | null;
  url: string;
  citaIfsul: boolean;
}

type Aba = "autor" | "partido" | "secretaria" | "emenda";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inteiro = new Intl.NumberFormat("pt-BR");
const td = "whitespace-nowrap px-2 py-1.5 text-right tabular-nums";
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";
const seletor = "rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const botao = (ativo: boolean) =>
  `rounded px-3 py-1.5 text-sm font-medium ${ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`;
const pct = (parte: number, todo: number) => (todo > 0 ? `${((parte / todo) * 100).toFixed(1).replace(".", ",")}%` : "-");
const ehEducacao = (s: string) => /EDUCA/i.test(s);

/** Situação curta: votada (encaminhada à sanção), em tramitação ou outra. */
function situacaoCurta(s: string | null): string {
  if (!s) return "sem registro";
  if (/San[çc][ãa]o|Promulga/i.test(s)) return "aprovada";
  if (/Arquiv|Retirad|Rejeit|Prejudic/i.test(s)) return "não seguiu";
  return "em tramitação";
}

/**
 * As emendas impositivas dos vereadores ao orçamento do município: a parte do orçamento que cada vereador e cada bancada destina, e
 * que a Prefeitura é obrigada a executar (salvo impedimento técnico). Lidas da página da Câmara, emenda a emenda.
 */
export function EmendasMunicipais({ emendas }: { emendas: EmendaDaTela[] }) {
  const anos = useMemo(() => [...new Set(emendas.map((e) => e.exercicio))].sort((a, b) => b - a), [emendas]);
  const anoPadrao = anos.find((a) => emendas.filter((e) => e.exercicio === a).length >= 50) ?? anos[0]!;
  const [ano, setAno] = useState<number>(anoPadrao);
  const [tipo, setTipo] = useState("");
  const [secretaria, setSecretaria] = useState("");
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("autor");
  const [aberto, setAberto] = useState<string | null>(null);

  const doAno = useMemo(() => emendas.filter((e) => e.exercicio === ano), [emendas, ano]);
  const secretarias = useMemo(() => [...new Set(doAno.map((e) => e.secretaria))].sort((a, b) => a.localeCompare(b, "pt-BR")), [doAno]);
  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return doAno.filter(
      (e) =>
        (!tipo || e.tipo === tipo) &&
        (!secretaria || e.secretaria === secretaria) &&
        (!b || `${e.objeto} ${e.justificativa ?? ""} ${e.autor} ${e.acao ?? ""}`.toLowerCase().includes(b)),
    );
  }, [doAno, tipo, secretaria, busca]);

  const total = filtradas.reduce((s, e) => s + e.valor, 0);
  const educacao = filtradas.filter((e) => ehEducacao(e.secretaria)).reduce((s, e) => s + e.valor, 0);
  const citamIfsul = filtradas.filter((e) => e.citaIfsul);

  const grupos = useMemo(() => {
    if (aba === "emenda") return [];
    const chave = (e: EmendaDaTela) => (aba === "autor" ? e.autor : aba === "partido" ? (e.partido ?? "sem partido informado") : e.secretaria);
    const m = new Map<string, EmendaDaTela[]>();
    for (const e of filtradas) m.set(chave(e), [...(m.get(chave(e)) ?? []), e]);
    return [...m.entries()].map(([k, es]) => ({ chave: k, emendas: es.sort((a, b) => b.valor - a.valor), valor: es.reduce((s, e) => s + e.valor, 0) })).sort((a, b) => b.valor - a.valor);
  }, [filtradas, aba]);

  const nomeDaColuna = { autor: "Vereador ou bancada", partido: "Partido", secretaria: "Secretaria que recebe", emenda: "Emenda" }[aba];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Orçamento de
          <select
            value={ano}
            onChange={(e) => {
              setAno(Number(e.target.value));
              setSecretaria("");
              setAberto(null);
            }}
            className={seletor}
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={seletor}>
            <option value="">Todos</option>
            <option value="Individual">Individual (de um vereador)</option>
            <option value="Bancada">De bancada (do partido)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Secretaria
          <select value={secretaria} onChange={(e) => setSecretaria(e.target.value)} className={seletor}>
            <option value="">Todas</option>
            {secretarias.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Procurar no texto
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="escola, APM, IFSul..." className={seletor} />
        </label>
        {(tipo || secretaria || busca) && (
          <button
            type="button"
            className="text-sm text-if-green underline"
            onClick={() => {
              setTipo("");
              setSecretaria("");
              setBusca("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Quadro titulo={`Emendas de ${ano}`} valor={reais.format(total)} nota={`${inteiro.format(filtradas.length)} emendas`} />
        <Quadro titulo="Para a educação" valor={reais.format(educacao)} nota={`${pct(educacao, total)} do valor das emendas`} />
        <Quadro titulo="Autores" valor={inteiro.format(new Set(filtradas.map((e) => e.autor)).size)} nota="vereadores e bancadas" />
        <Quadro
          titulo="Citam o IFSul"
          valor={inteiro.format(citamIfsul.length)}
          nota={citamIfsul.length > 0 ? reais.format(citamIfsul.reduce((s, e) => s + e.valor, 0)) : "nenhuma emenda deste ano cita o IFSul ou o Instituto Federal"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["autor", "Por vereador ou bancada"],
            ["partido", "Por partido"],
            ["secretaria", "Por secretaria"],
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

      {aba === "emenda" ? (
        <ListaDeEmendas emendas={[...filtradas].sort((a, b) => b.valor - a.valor)} />
      ) : (
        <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">{nomeDaColuna}</th>
                <th className={th}>Emendas</th>
                <th className={th}>Valor</th>
                <th className={th}>Parte do total</th>
                <th className={th}>Para a educação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {grupos.map((g) => {
                const estaAberto = aberto === g.chave;
                const edu = g.emendas.filter((e) => ehEducacao(e.secretaria)).reduce((s, e) => s + e.valor, 0);
                return (
                  <Fragment key={g.chave}>
                    <tr className={estaAberto ? "bg-if-green/10" : aba === "secretaria" && ehEducacao(g.chave) ? "bg-if-green/5 font-medium" : undefined}>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => setAberto(estaAberto ? null : g.chave)} aria-expanded={estaAberto} className="inline-flex items-center gap-2 text-left hover:text-if-green">
                          <SinalMaisMenos aberto={estaAberto} />
                          {g.chave}
                          {aba === "autor" && g.emendas[0]?.partido && (
                            <span className="text-xs font-normal text-neutral-500">
                              ({g.emendas[0].partido}
                              {g.emendas[0].partidoInferido ? "*" : ""})
                            </span>
                          )}
                        </button>
                      </td>
                      <td className={td}>{g.emendas.length}</td>
                      <td className={td}>{reais.format(g.valor)}</td>
                      <td className={td}>{pct(g.valor, total)}</td>
                      <td className={td}>{edu > 0 ? reais.format(edu) : "-"}</td>
                    </tr>
                    {estaAberto && (
                      <tr data-detalhe="1">
                        <td colSpan={5} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                          <div className="sticky left-0 w-[min(88vw,72rem)] overflow-x-auto rounded-md border-l-4 border-if-green bg-white p-3 dark:bg-neutral-950">
                            <ListaDeEmendas emendas={g.emendas} compacta />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
              <tr>
                <td className="px-2 py-1.5">Soma</td>
                <td className={td}>{filtradas.length}</td>
                <td className={td}>{reais.format(total)}</td>
                <td className={td}>100%</td>
                <td className={td}>{reais.format(educacao)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {aba === "autor" && filtradas.some((e) => e.partidoInferido) && (
        <p className="text-xs text-neutral-500">
          * Partido tirado de outra emenda do mesmo vereador: o formulário deste ano não traz o partido ao lado do nome.
        </p>
      )}
    </div>
  );
}

function ListaDeEmendas({ emendas, compacta }: { emendas: EmendaDaTela[]; compacta?: boolean }) {
  const [aberta, setAberta] = useState<number | null>(null);
  return (
    <div className={compacta ? "" : "tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800"}>
      <table className="min-w-full text-xs">
        <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className="px-2 py-1 text-left font-medium">Emenda</th>
            <th className="px-2 py-1 text-left font-medium">Autor</th>
            <th className="px-2 py-1 text-left font-medium">Para quê</th>
            <th className="px-2 py-1 text-left font-medium">Secretaria</th>
            <th className={th}>Valor</th>
            <th className="px-2 py-1 text-left font-medium">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {emendas.map((e) => {
            const estaAberta = aberta === e.id;
            return (
              <Fragment key={e.id}>
                <tr className={e.citaIfsul ? "bg-if-green/10" : undefined}>
                  <td className="whitespace-nowrap px-2 py-1">
                    <button type="button" onClick={() => setAberta(estaAberta ? null : e.id)} aria-expanded={estaAberta} className="inline-flex items-center gap-2 hover:text-if-green">
                      <SinalMaisMenos aberto={estaAberta} />
                      {e.numero || `nº ${e.id}`}
                    </button>
                    <span className="block pl-6 text-neutral-500">{e.tipo === "Bancada" ? "de bancada" : "individual"}</span>
                  </td>
                  <td className="px-2 py-1">
                    {e.autor}
                    {e.partido && (
                      <span className="text-neutral-500">
                        {" "}
                        ({e.partido}
                        {e.partidoInferido ? "*" : ""})
                      </span>
                    )}
                  </td>
                  <td className="min-w-[16rem] whitespace-normal px-2 py-1">{e.objeto.replace(/^Emenda Impositiva ao Projeto de Lei do Executivo n[ºo°] ?\d+\/\d{4}\.?\s*/i, "")}</td>
                  <td className="px-2 py-1">{e.secretaria}</td>
                  <td className={td}>{reais.format(e.valor)}</td>
                  <td className="whitespace-nowrap px-2 py-1">{situacaoCurta(e.situacao)}</td>
                </tr>
                {estaAberta && (
                  <tr data-detalhe="1">
                    <td colSpan={6} className="bg-neutral-50 p-3 dark:bg-neutral-900/60">
                      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[10rem_1fr]">
                        {e.justificativa && (
                          <>
                            <dt className="font-medium text-neutral-500">Justificativa</dt>
                            <dd>{e.justificativa}</dd>
                          </>
                        )}
                        {e.acao && (
                          <>
                            <dt className="font-medium text-neutral-500">Ação do orçamento</dt>
                            <dd>{e.acao}</dd>
                          </>
                        )}
                        {e.situacao && (
                          <>
                            <dt className="font-medium text-neutral-500">Situação na Câmara</dt>
                            <dd>{e.situacao}</dd>
                          </>
                        )}
                        {e.apresentadaEm && (
                          <>
                            <dt className="font-medium text-neutral-500">Apresentada em</dt>
                            <dd>{e.apresentadaEm}</dd>
                          </>
                        )}
                        <dt className="font-medium text-neutral-500">Na Câmara</dt>
                        <dd>
                          <a href={e.url} target="_blank" rel="noreferrer" className="text-if-green underline">
                            abrir a emenda no site da Câmara
                          </a>
                        </dd>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Quadro({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{titulo}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</div>
      <div className="mt-1 text-xs text-neutral-500">{nota}</div>
    </div>
  );
}
