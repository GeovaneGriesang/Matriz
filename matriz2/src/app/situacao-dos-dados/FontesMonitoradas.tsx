"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { apiUrl } from "@/lib/basePath";

export interface FonteNaTela {
  id: number;
  nome: string;
  url: string;
  assunto: string;
  verificadoEm: string | null;
  mudouEm: string | null;
  erro: string | null;
  historico: Array<{ em: string; mudou: boolean; novidades: string | null; erro: string | null }>;
}

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "-");

export function FontesMonitoradas({ fontes, podeVerificar }: { fontes: FonteNaTela[]; podeVerificar: boolean }) {
  const [aberta, setAberta] = useState<number | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();
  const umaSemana = Date.now() - 8 * 24 * 3600 * 1000;

  async function verificarAgora() {
    setVerificando(true);
    setAviso(null);
    try {
      const r = await fetch(apiUrl("/api/fontes/verificar"), { method: "POST" });
      const j = (await r.json()) as { mudaram?: number; erros?: number; erro?: string };
      setAviso(r.ok ? `Conferência feita: ${j.mudaram} fonte(s) mudaram, ${j.erros} não responderam.` : (j.erro ?? "Não foi possível conferir agora."));
      router.refresh();
    } catch {
      setAviso("Não foi possível conferir agora.");
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {podeVerificar && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={verificarAgora} disabled={verificando} className="rounded bg-if-green px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            {verificando ? "Conferindo (leva até um minuto)..." : "Conferir agora"}
          </button>
          {aviso && <span className="text-sm text-neutral-600 dark:text-neutral-400">{aviso}</span>}
        </div>
      )}
      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">Fonte</th>
              <th className="px-3 py-2">O que alimenta</th>
              <th className="px-3 py-2">Conferida em</th>
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {fontes.map((f) => {
              const estaAberta = aberta === f.id;
              const mudouRecente = f.mudouEm !== null && new Date(f.mudouEm).getTime() > umaSemana;
              return (
                <Fragment key={f.id}>
                  <tr className={estaAberta ? "bg-if-green/10" : undefined}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setAberta(estaAberta ? null : f.id)} aria-expanded={estaAberta} className="inline-flex items-center gap-2 text-left font-medium hover:text-if-green">
                        <SinalMaisMenos aberto={estaAberta} />
                        {f.nome}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{f.assunto}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{data(f.verificadoEm)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {f.erro ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">não respondeu</span>
                      ) : mudouRecente ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-300">mudou em {data(f.mudouEm).slice(0, 10)}</span>
                      ) : (
                        <span className="rounded bg-if-green/15 px-2 py-0.5 text-xs font-semibold text-if-green">sem mudança</span>
                      )}
                    </td>
                  </tr>
                  {estaAberta && (
                    <tr data-detalhe="1">
                      <td colSpan={4} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                        <div className="flex flex-col gap-2 rounded-md border-l-4 border-if-green bg-white p-4 text-sm dark:bg-neutral-950">
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="break-all text-if-green underline">
                            {f.url}
                          </a>
                          {f.historico.length === 0 && <p className="text-neutral-500">Ainda não conferida.</p>}
                          {f.historico.map((h, i) => (
                            <div key={i} className="flex flex-col gap-1">
                              <span className="font-medium">
                                {data(h.em)}: {h.erro ? `não respondeu (${h.erro})` : h.mudou ? "mudou" : h.novidades?.startsWith("Primeira") ? "primeira conferência" : "sem mudança"}
                              </span>
                              {h.novidades && <pre className="whitespace-pre-wrap break-all text-xs text-neutral-600 dark:text-neutral-400">{h.novidades}</pre>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
