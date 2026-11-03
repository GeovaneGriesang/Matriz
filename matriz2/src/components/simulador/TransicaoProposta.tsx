"use client";

import { useMemo, useState } from "react";
import { ehCampusDestaque } from "@/lib/destaque";
import { ETAPAS_DA_PROPOSTA, transicaoDoCampus } from "@/lib/mdo/transicaoCumulativa";

export interface CampusDaTransicao {
  id: number;
  nome: string;
  /** Valor informado de 2026; nulo se o câmpus não recebeu nada (câmpus novo). */
  base: number | null;
  matriz2027: number;
  /** Matriz de 2027, 2028 e 2029 pela projeção dos cursos. */
  matrizesPelaProjecao: number[];
  /** Falso quando o câmpus não tem ciclos para projetar (recebe só o Piso Mínimo). */
  temCiclos: boolean;
}

type Cenario = "constante" | "projecao";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const fracao = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

const cor = (v: number) => (Math.abs(v) < 0.005 ? "text-neutral-500" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400");
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";
const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums";

export function TransicaoProposta({ campi }: { campi: CampusDaTransicao[] }) {
  const [cenario, setCenario] = useState<Cenario>("constante");
  const [abertoId, setAbertoId] = useState<number | null>(campi.find((c) => ehCampusDestaque(c.nome))?.id ?? null);

  const linhas = useMemo(
    () =>
      campi.map((c) => {
        const matrizes = cenario === "constante" ? [c.matriz2027, c.matriz2027, c.matriz2027] : c.matrizesPelaProjecao;
        const base = c.base ?? 0;
        const anos = transicaoDoCampus(base, matrizes);
        return { ...c, baseValor: base, anos, final: anos[anos.length - 1]!.valor };
      }),
    [campi, cenario],
  );

  const somaBase = linhas.reduce((s, l) => s + l.baseValor, 0);
  const somas = ETAPAS_DA_PROPOSTA.map((_, i) => ({
    matriz: linhas.reduce((s, l) => s + l.anos[i]!.matriz, 0),
    valor: linhas.reduce((s, l) => s + l.anos[i]!.valor, 0),
  }));
  const aberto = linhas.find((l) => l.id === abertoId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Matriz de 2028 e 2029</span>
        {(
          [
            ["constante", "Igual à de 2027 (como no exemplo do documento)"],
            ["projecao", "Pela projeção dos cursos de cada câmpus"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setCenario(valor)}
            aria-pressed={cenario === valor}
            className={`rounded px-3 py-1.5 font-medium ${cenario === valor ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <p className="max-w-4xl text-sm text-neutral-600 dark:text-neutral-400">
        {cenario === "constante"
          ? "A matriz de 2028 e 2029 fica igual à de 2027, sem inflação nem mudança de matrículas. Mostra só o efeito da regra de transição."
          : "A matriz de cada câmpus acompanha o que os cursos dele rendem nos anos seguintes: as turmas em andamento até terminarem, com a evasão média do IFSul, e a reposição das turmas. O valor da matrícula fica o de hoje; o orçamento da rede e as matrículas dos outros institutos não são conhecidos. É uma estimativa, não a matriz oficial desses anos."}
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1 text-left font-medium" rowSpan={2}>Câmpus</th>
              <th className={th} rowSpan={2}>Base 2026</th>
              {ETAPAS_DA_PROPOSTA.map((e) => (
                <th key={e.ano} className="border-l border-neutral-200 px-2 py-1 text-center font-medium dark:border-neutral-800" colSpan={3}>
                  {e.ano} ({e.fracao === 1 ? "100% da matriz" : `incorpora ${fracao.format(e.fracao)} da diferença`})
                </th>
              ))}
              <th className="border-l border-neutral-200 px-2 py-1 text-center font-medium dark:border-neutral-800" colSpan={2}>2029 contra 2026</th>
            </tr>
            <tr>
              {ETAPAS_DA_PROPOSTA.map((e) => (
                <FragmentoCabecalho key={e.ano} />
              ))}
              <th className={th}>R$</th>
              <th className={th}>%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {linhas.map((l) => {
              const dif = l.final - l.baseValor;
              return (
                <tr key={l.id} className={l.id === abertoId ? "bg-if-green/10" : ehCampusDestaque(l.nome) ? "bg-if-green/5" : undefined}>
                  <td className="whitespace-nowrap px-2 py-1 text-left">
                    <button type="button" onClick={() => setAbertoId(l.id === abertoId ? null : l.id)} className="font-medium text-if-green underline decoration-if-green/40 underline-offset-2">
                      {l.nome}
                    </button>
                  </td>
                  <td className={td}>{l.base === null ? "sem base" : reais.format(l.base)}</td>
                  {l.anos.map((a) => (
                    <FragmentoAno key={a.ano} matriz={a.matriz} valor={a.valor} variacao={a.variacao} />
                  ))}
                  <td className={`${td} ${cor(dif)}`}>{reais.format(dif)}</td>
                  <td className={`${td} ${cor(dif)}`}>{l.baseValor > 0 ? pct.format(dif / l.baseValor) : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
            <tr>
              <td className="px-2 py-1 text-left">Soma dos câmpus</td>
              <td className={td}>{reais.format(somaBase)}</td>
              {somas.map((s, i) => (
                <FragmentoAno key={i} matriz={s.matriz} valor={s.valor} variacao={(i === 0 ? somaBase : somas[i - 1]!.valor) > 0 ? s.valor / (i === 0 ? somaBase : somas[i - 1]!.valor) - 1 : null} />
              ))}
              <td className={`${td} ${cor(somas[2]!.valor - somaBase)}`}>{reais.format(somas[2]!.valor - somaBase)}</td>
              <td className={`${td} ${cor(somas[2]!.valor - somaBase)}`}>{somaBase > 0 ? pct.format(somas[2]!.valor / somaBase - 1) : ""}</td>
            </tr>
            <tr className="font-normal">
              <td className="px-2 py-1 text-left">Soma da proposta menos a soma da matriz</td>
              <td className={td}></td>
              {somas.map((s, i) => (
                <td key={i} className={`${td} ${cor(s.valor - s.matriz)} border-l border-neutral-200 dark:border-neutral-800`} colSpan={3}>
                  {reais.format(s.valor - s.matriz)}
                </td>
              ))}
              <td className={td} colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="max-w-4xl text-xs text-neutral-500 dark:text-neutral-400">
        A regra não reparte um total fixo: cada câmpus anda em direção à própria matriz. Por isso, em 2027 e 2028, a soma dos câmpus não é igual à soma da matriz, e a última linha mostra a diferença. O
        documento não diz de onde sairia ou para onde iria essa diferença. Só entra o Funcionamento dos câmpus: Reitoria, Qualidade e Eficiência e Assistência Estudantil ficam de fora.
      </p>

      {aberto && (
        <div className="flex flex-col gap-2 rounded-lg border border-if-green/40 bg-if-green/5 p-4 text-sm">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">A conta de {aberto.nome}</h3>
          {aberto.base === null && <p className="text-amber-800 dark:text-amber-300">Este câmpus não tem valor em 2026: a transição parte de zero.</p>}
          {!aberto.temCiclos && cenario === "projecao" && <p className="text-amber-800 dark:text-amber-300">Sem ciclos para projetar: a matriz fica igual à de 2027.</p>}
          <ul className="flex flex-col gap-1 text-neutral-700 dark:text-neutral-300">
            {aberto.anos.map((a) =>
              a.fracao === 1 ? (
                <li key={a.ano}>
                  <strong>{a.ano}:</strong> adota a matriz do ano inteira = {reais.format(a.valor)}
                </li>
              ) : (
                <li key={a.ano}>
                  <strong>{a.ano}:</strong> {reais.format(a.base)} + {fracao.format(a.fracao)} × ({reais.format(a.matriz)} − {reais.format(a.base)}) = {reais.format(a.base)} {a.acrescimo < 0 ? "−" : "+"}{" "}
                  {reais.format(Math.abs(a.acrescimo))} = <strong>{reais.format(a.valor)}</strong>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function FragmentoCabecalho() {
  return (
    <>
      <th className={`${th} border-l border-neutral-200 dark:border-neutral-800`}>Matriz</th>
      <th className={th}>Proposta</th>
      <th className={th}>Var.</th>
    </>
  );
}

function FragmentoAno({ matriz, valor, variacao }: { matriz: number; valor: number; variacao: number | null }) {
  return (
    <>
      <td className={`${td} border-l border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400`}>{reais.format(matriz)}</td>
      <td className={`${td} font-medium`}>{reais.format(valor)}</td>
      <td className={`${td} ${variacao === null ? "" : cor(variacao * 100)}`}>{variacao === null ? "" : pct.format(variacao)}</td>
    </>
  );
}
