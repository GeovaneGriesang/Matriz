"use client";

import { useMemo, useState } from "react";

export interface LinhaSimulavel {
  chave: string;
  nome: string;
  recebido: number;
  perda: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

/**
 * Simulador de cenário de evasão, client-side. Ao contrário do Simulador antigo (que
 * recalculava a matriz inteira a partir dos microdados da PNP), este parte de um
 * único número que a MDO já publica por ciclo de curso: `perdaEvasaoReais`. Reduzir a
 * evasão em X% recupera X% dessa perda; é interpolação linear sobre um valor oficial,
 * não uma nova fórmula da matriz.
 */
export function SimuladorEvasao({ linhas, redeTaxa }: { linhas: LinhaSimulavel[]; redeTaxa: number }) {
  const [chaveEscolhida, setChaveEscolhida] = useState(linhas[0]?.chave ?? "");
  const [reducao, setReducao] = useState(50);

  const linha = useMemo(() => linhas.find((l) => l.chave === chaveEscolhida) ?? linhas[0], [linhas, chaveEscolhida]);

  const { recuperado, novoRecebido, novaPerda, taxaAtual, novaTaxa } = useMemo(() => {
    if (!linha) return { recuperado: 0, novoRecebido: 0, novaPerda: 0, taxaAtual: 0, novaTaxa: 0 };
    const fracao = reducao / 100;
    const recuperadoCalc = linha.perda * fracao;
    const novoRecebidoCalc = linha.recebido + recuperadoCalc;
    const novaPerdaCalc = linha.perda - recuperadoCalc;
    return {
      recuperado: recuperadoCalc,
      novoRecebido: novoRecebidoCalc,
      novaPerda: novaPerdaCalc,
      taxaAtual: pct(linha.perda, linha.recebido),
      novaTaxa: pct(novaPerdaCalc, novoRecebidoCalc),
    };
  }, [linha, reducao]);

  if (!linha) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Esta instituição não tem perda por evasão registrada neste ciclo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Câmpus</span>
            <select
              value={chaveEscolhida}
              onChange={(e) => setChaveEscolhida(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {linhas.map((l) => (
                <option key={l.chave} value={l.chave} disabled={l.perda === 0}>
                  {l.nome}
                  {l.perda === 0 ? " (sem perda por evasão)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="flex items-baseline justify-between font-medium text-neutral-900 dark:text-neutral-100">
              <span>Redução simulada da evasão</span>
              <span className="tabular-nums text-if-green">{reducao}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={reducao}
              onChange={(e) => setReducao(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-if-green dark:bg-neutral-800"
              aria-label="Percentual de redução da evasão simulada"
            />
            <div className="flex justify-between text-xs text-neutral-500">
              <span>0%, sem mudança</span>
              <span>100%, evasão zerada</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Recebido hoje" valor={reais.format(linha.recebido)} />
        <Cartao rotulo="Recebido no cenário" valor={reais.format(novoRecebido)} destaque="text-if-green" />
        <Cartao rotulo="Recuperado" valor={reais.format(recuperado)} destaque="text-if-green" />
        <Cartao
          rotulo="Taxa de perda"
          valor={`${doisDecimais.format(taxaAtual)}% → ${doisDecimais.format(novaTaxa)}%`}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400"></th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Recebido</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Perda</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Taxa</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">Hoje</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(linha.recebido)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
                {reais.format(linha.perda)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{doisDecimais.format(taxaAtual)}%</td>
            </tr>
            <tr className="border-t border-neutral-200 bg-if-green/5 font-medium dark:border-neutral-800">
              <td className="px-4 py-2.5">No cenário simulado</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-if-green">{reais.format(novoRecebido)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
                {reais.format(novaPerda)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{doisDecimais.format(novaTaxa)}%</td>
            </tr>
            <tr className="border-t border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <td className="px-4 py-2.5">Média da rede, hoje</td>
              <td className="px-4 py-2.5 text-right tabular-nums">—</td>
              <td className="px-4 py-2.5 text-right tabular-nums">—</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{doisDecimais.format(redeTaxa)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${destaque ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {valor}
      </div>
    </div>
  );
}
