"use client";

import { Fragment, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import type { LinhaDeFuncao } from "@/server/queries/orcamentoPublico";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (parte: number, todo: number) => (todo > 0 ? `${((parte / todo) * 100).toFixed(1).replace(".", ",")}%` : "-");
const td = "whitespace-nowrap px-2 py-1.5 text-right tabular-nums";
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";

/**
 * A despesa do ano por área de governo (função), da maior para a menor. O + de cada área abre as subfunções logo abaixo da linha.
 * "Executado" é o liquidado sobre a dotação atualizada: quanto do que se pode gastar no ano já virou serviço prestado ou bem entregue.
 */
export function ExecucaoPorFuncao({ funcoes, ano, periodo, destaque = "Educação" }: { funcoes: LinhaDeFuncao[]; ano: number; periodo: number; destaque?: string }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const total = funcoes.reduce(
    (s, f) => ({ dotacaoInicial: s.dotacaoInicial + f.dotacaoInicial, dotacaoAtualizada: s.dotacaoAtualizada + f.dotacaoAtualizada, empenhado: s.empenhado + f.empenhado, liquidado: s.liquidado + f.liquidado }),
    { dotacaoInicial: 0, dotacaoAtualizada: 0, empenhado: 0, liquidado: 0 },
  );
  const exemplo = funcoes.find((f) => f.nome === destaque);
  const anoFechado = periodo === 6;

  return (
    <div className="flex flex-col gap-2">
      <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Área (função)</th>
              <th className={th}>Dotação inicial</th>
              <th className={th}>Dotação atualizada</th>
              <th className={th}>Empenhado</th>
              <th className={th}>Liquidado</th>
              <th className={th} title="Liquidado sobre a dotação atualizada">
                Executado
              </th>
              <th className={th} title="Parte desta área no total liquidado">
                Parte do total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {funcoes.map((f) => {
              const estaAberto = aberto === f.nome;
              const ehDestaque = f.nome === destaque;
              return (
                <Fragment key={f.nome}>
                  <tr className={estaAberto ? "bg-if-green/10" : ehDestaque ? "bg-if-green/5 font-medium" : undefined}>
                    <td className="px-2 py-1.5">
                      {f.subfuncoes.length > 0 ? (
                        <button type="button" onClick={() => setAberto(estaAberto ? null : f.nome)} aria-expanded={estaAberto} className="inline-flex items-center gap-2 text-left hover:text-if-green">
                          <SinalMaisMenos aberto={estaAberto} />
                          {f.nome}
                        </button>
                      ) : (
                        <span className="pl-6">{f.nome}</span>
                      )}
                    </td>
                    <td className={td}>{reais.format(f.dotacaoInicial)}</td>
                    <td className={td}>{reais.format(f.dotacaoAtualizada)}</td>
                    <td className={td}>{reais.format(f.empenhado)}</td>
                    <td className={td}>{reais.format(f.liquidado)}</td>
                    <td className={td}>{pct(f.liquidado, f.dotacaoAtualizada)}</td>
                    <td className={td}>{pct(f.liquidado, total.liquidado)}</td>
                  </tr>
                  {estaAberto && (
                    <tr data-detalhe="1">
                      <td colSpan={7} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                        <div className="sticky left-0 w-[min(88vw,72rem)] overflow-x-auto rounded-md border-l-4 border-if-green bg-white p-3 dark:bg-neutral-950">
                          <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
                            As partes de {f.nome.toLowerCase()}. "Administração geral" é o custeio da própria secretaria (prédio, pessoal de apoio, sistemas); "demais
                            subfunções" junta o que o relatório não abre.
                          </p>
                          <table className="min-w-full text-xs">
                            <thead className="text-neutral-500">
                              <tr>
                                <th className="px-2 py-1 text-left font-medium">Subfunção</th>
                                <th className={th}>Dotação atualizada</th>
                                <th className={th}>Empenhado</th>
                                <th className={th}>Liquidado</th>
                                <th className={th}>Parte da área</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                              {f.subfuncoes.map((s) => (
                                <tr key={s.nome}>
                                  <td className="px-2 py-1">{s.nome}</td>
                                  <td className={td}>{reais.format(s.dotacaoAtualizada)}</td>
                                  <td className={td}>{reais.format(s.empenhado)}</td>
                                  <td className={td}>{reais.format(s.liquidado)}</td>
                                  <td className={td}>{pct(s.liquidado, f.liquidado)}</td>
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
              <td className="px-2 py-1.5">Total</td>
              <td className={td}>{reais.format(total.dotacaoInicial)}</td>
              <td className={td}>{reais.format(total.dotacaoAtualizada)}</td>
              <td className={td}>{reais.format(total.empenhado)}</td>
              <td className={td}>{reais.format(total.liquidado)}</td>
              <td className={td}>{pct(total.liquidado, total.dotacaoAtualizada)}</td>
              <td className={td}>100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {exemplo && (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          <strong>Como ler, com {exemplo.nome.toLowerCase()}:</strong> a lei de {ano} autorizou {reais.format(exemplo.dotacaoInicial)}; com os créditos do ano, a
          dotação foi a {reais.format(exemplo.dotacaoAtualizada)}. Até o {periodo}º bimestre, {reais.format(exemplo.empenhado)} foram reservados (empenhados) e{" "}
          {reais.format(exemplo.liquidado)} viraram serviço ou bem entregue (liquidados), ou seja, {pct(exemplo.liquidado, exemplo.dotacaoAtualizada)} da dotação.{" "}
          {anoFechado
            ? "Como o ano está fechado, o que foi empenhado e não liquidado virou resto a pagar no ano seguinte."
            : `O ano ainda não terminou: o percentual sobe até dezembro (cada bimestre equivale a cerca de ${pct(1, 6)} do ano).`}
        </p>
      )}
    </div>
  );
}
