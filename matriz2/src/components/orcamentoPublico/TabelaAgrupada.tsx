"use client";

import { Fragment, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";

export interface ItemAgrupado {
  rotulo: string;
  valor: number;
  nota?: string;
}

export interface GrupoAgrupado extends ItemAgrupado {
  chave: string;
  filhos: ItemAgrupado[];
  destaque?: boolean;
}

export interface VisaoAgrupada {
  id: string;
  rotulo: string;
  explicacao: string;
  colunaGrupo: string;
  colunaFilho: string;
  grupos: GrupoAgrupado[];
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (parte: number, todo: number) => (todo !== 0 ? `${((parte / todo) * 100).toFixed(1).replace(".", ",")}%` : "-");
const td = "whitespace-nowrap px-2 py-1.5 text-right tabular-nums";
const botao = (ativo: boolean) =>
  `rounded px-3 py-1.5 text-sm font-medium ${ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`;

/**
 * Uma tabela com abas (cada aba agrupa o mesmo dinheiro de um jeito: por área, por órgão, por grupo de despesa...) e o + em cada
 * linha, que abre logo abaixo o que forma aquele valor.
 */
export function TabelaAgrupada({ visoes, total, rotuloTotal = "Total" }: { visoes: VisaoAgrupada[]; total: number; rotuloTotal?: string }) {
  const [idVisao, setIdVisao] = useState(visoes[0]?.id ?? "");
  const [aberto, setAberto] = useState<string | null>(null);
  const visao = visoes.find((v) => v.id === idVisao) ?? visoes[0];
  if (!visao) return null;
  const exemplo = visao.grupos.find((g) => g.destaque) ?? visao.grupos[0];

  return (
    <div className="flex flex-col gap-3">
      {visoes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {visoes.map((v) => (
            <button
              key={v.id}
              type="button"
              className={botao(v.id === visao.id)}
              onClick={() => {
                setIdVisao(v.id);
                setAberto(null);
              }}
            >
              {v.rotulo}
            </button>
          ))}
        </div>
      )}
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{visao.explicacao}</p>
      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">{visao.colunaGrupo}</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">Valor</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium">Parte do total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {visao.grupos.map((g) => {
              const estaAberto = aberto === g.chave;
              return (
                <Fragment key={g.chave}>
                  <tr className={estaAberto ? "bg-if-green/10" : g.destaque ? "bg-if-green/5 font-medium" : undefined}>
                    <td className="px-2 py-1.5">
                      {g.filhos.length > 0 ? (
                        <button type="button" onClick={() => setAberto(estaAberto ? null : g.chave)} aria-expanded={estaAberto} className="inline-flex items-center gap-2 text-left hover:text-if-green">
                          <SinalMaisMenos aberto={estaAberto} />
                          {g.rotulo}
                        </button>
                      ) : (
                        <span className="pl-6">{g.rotulo}</span>
                      )}
                      {g.nota && <span className="block pl-6 text-xs font-normal text-neutral-500">{g.nota}</span>}
                    </td>
                    <td className={`${td} ${g.valor < 0 ? "text-if-red dark:text-red-400" : ""}`}>{reais.format(g.valor)}</td>
                    <td className={td}>{pct(g.valor, total)}</td>
                  </tr>
                  {estaAberto && (
                    <tr data-detalhe="1">
                      <td colSpan={3} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                        <div className="sticky left-0 w-[min(88vw,72rem)] overflow-x-auto rounded-md border-l-4 border-if-green bg-white p-3 dark:bg-neutral-950">
                          <table className="min-w-full text-xs">
                            <thead className="text-neutral-500">
                              <tr>
                                <th className="px-2 py-1 text-left font-medium">{visao.colunaFilho}</th>
                                <th className="whitespace-nowrap px-2 py-1 text-right font-medium">Valor</th>
                                <th className="whitespace-nowrap px-2 py-1 text-right font-medium">Parte da linha</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {g.filhos.map((f, i) => (
                                <tr key={`${f.rotulo}-${i}`}>
                                  <td className="px-2 py-1">
                                    {f.rotulo}
                                    {f.nota && <span className="block text-neutral-500">{f.nota}</span>}
                                  </td>
                                  <td className={`${td} ${f.valor < 0 ? "text-if-red dark:text-red-400" : ""}`}>{reais.format(f.valor)}</td>
                                  <td className={td}>{pct(f.valor, g.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
              <td className="px-2 py-1.5">{rotuloTotal}</td>
              <td className={td}>{reais.format(total)}</td>
              <td className={td}>100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {exemplo && exemplo.filhos.length > 0 && (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Exemplo: o + de {exemplo.rotulo.toLowerCase()} abre as {exemplo.filhos.length} partes que somam {reais.format(exemplo.valor)}, {pct(exemplo.valor, total)} do total.
          A maior é {exemplo.filhos[0]!.rotulo.toLowerCase()}, com {reais.format(exemplo.filhos[0]!.valor)}.
        </p>
      )}
    </div>
  );
}
