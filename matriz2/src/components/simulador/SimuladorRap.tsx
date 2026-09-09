"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { faixaRap, pesoRap, type FaixaRap } from "@/lib/qualidadeEficiencia";
import { PROSE_LINK } from "@/lib/layoutWidths";

export interface InstituicaoRap {
  sigla: string;
  nome: string;
  rapPresencial: number;
  /** Soma do RAP ponderado recalculado de TODAS as outras instituições da rede (a
   * desta instituição fica de fora, porque é o que muda ao simular). Com isso o
   * componente reencaixa a instituição escolhida numa faixa hipotética sem precisar
   * da rede inteira no cliente. */
  restoRedeRapPonderado: number;
  rapEqualizadoOficial: number | null;
  vlRapOficial: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROTULO_FAIXA: Record<FaixaRap, string> = {
  MUITO_BAIXA: "muito baixa, abaixo de 18",
  BAIXA: "baixa, de 18 a 20",
  MEDIA: "média, de 20 a 22",
  MUITO_ALTA: "muito alta, 22 ou mais",
};

/**
 * E se a RAP (Relação Aluno-Professor Presencial) de uma instituição mudasse? Ao
 * contrário da perda por evasão, a RAP é sempre um indicador de INSTITUIÇÃO, nunca
 * de câmpus isolado (ver /como-funciona#qualidade-eficiencia): por isso este
 * simulador escolhe uma instituição, não um câmpus. Reusa a mesma fórmula e as
 * mesmas faixas da Conferência (/conferencia), só que reencaixando o valor
 * hipotético na soma da rede para ver o efeito em reais.
 */
export function SimuladorRap({
  instituicoes,
  totalBlocoRap,
  ano,
}: {
  instituicoes: InstituicaoRap[];
  totalBlocoRap: number;
  ano: number;
}) {
  const [siglaEscolhida, setSiglaEscolhida] = useState(instituicoes[0]?.sigla ?? "");
  const inst = instituicoes.find((i) => i.sigla === siglaEscolhida) ?? instituicoes[0];
  const [rapSimulada, setRapSimulada] = useState(() => inst?.rapPresencial ?? 0);

  function escolher(sigla: string) {
    setSiglaEscolhida(sigla);
    const novo = instituicoes.find((i) => i.sigla === sigla);
    setRapSimulada(novo?.rapPresencial ?? 0);
  }

  const resultado = useMemo(() => {
    if (!inst) return null;
    const faixaAtual = faixaRap(inst.rapPresencial);
    const pesoAtual = pesoRap(faixaAtual);
    const ponderadoAtual = inst.rapPresencial * pesoAtual;

    const faixaSimulada = faixaRap(rapSimulada);
    const pesoSimulado = pesoRap(faixaSimulada);
    const ponderadoSimulado = rapSimulada * pesoSimulado;

    const somaAtual = inst.restoRedeRapPonderado + ponderadoAtual;
    const somaSimulada = inst.restoRedeRapPonderado + ponderadoSimulado;

    const equalizadoAtual = somaAtual > 0 ? ponderadoAtual / somaAtual : 0;
    const equalizadoSimulado = somaSimulada > 0 ? ponderadoSimulado / somaSimulada : 0;

    const valorAtual = equalizadoAtual * totalBlocoRap;
    const valorSimulado = equalizadoSimulado * totalBlocoRap;

    return {
      faixaAtual, pesoAtual, faixaSimulada, pesoSimulado,
      valorAtual, valorSimulado, diferenca: valorSimulado - valorAtual,
    };
  }, [inst, rapSimulada, totalBlocoRap]);

  if (!inst || !resultado) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Nenhuma instituição com indicador de RAP carregado neste ciclo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Instituição</span>
            <select
              value={siglaEscolhida}
              onChange={(e) => escolher(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {instituicoes.map((i) => (
                <option key={i.sigla} value={i.sigla}>
                  {i.sigla}, {i.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="flex items-baseline justify-between font-medium text-neutral-900 dark:text-neutral-100">
              <span>RAP Presencial simulada</span>
              <span className="tabular-nums text-if-green">{decimal.format(rapSimulada)}</span>
            </span>
            <input
              type="range"
              min={10}
              max={30}
              step={0.1}
              value={rapSimulada}
              onChange={(e) => setRapSimulada(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-if-green dark:bg-neutral-800"
              aria-label="RAP Presencial simulada"
            />
            <div className="flex justify-between text-xs text-neutral-500">
              <span>10, poucos alunos por professor</span>
              <span>30, muitos alunos por professor</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          RAP hoje: {decimal.format(inst.rapPresencial)} (faixa {ROTULO_FAIXA[resultado.faixaAtual]}, peso{" "}
          {decimal.format(resultado.pesoAtual)}×). Faixas e pesos explicados em{" "}
          <Link href="/como-funciona#qualidade-eficiencia" className={PROSE_LINK}>
            Qualidade e Eficiência
          </Link>
          ; conferência linha a linha em{" "}
          <Link href={`/conferencia?ano=${ano}&instituicao=${inst.sigla}`} className={PROSE_LINK}>
            Conferência
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao rotulo="Faixa simulada" valor={ROTULO_FAIXA[resultado.faixaSimulada]} />
        <Cartao rotulo="Peso simulado" valor={`${decimal.format(resultado.pesoSimulado)}×`} />
        <Cartao rotulo="Valor recalculado (bloco RAP)" valor={reais.format(resultado.valorSimulado)} destaque="text-if-green" />
        <Cartao
          rotulo="Diferença"
          valor={`${resultado.diferenca >= 0 ? "+" : ""}${reais.format(resultado.diferenca)}`}
          destaque={resultado.diferenca >= 0 ? "text-if-green" : "text-if-red dark:text-red-400"}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400"></th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">RAP</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Faixa</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Peso</th>
              <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">
                Valor recalculado
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">Hoje</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{decimal.format(inst.rapPresencial)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{ROTULO_FAIXA[resultado.faixaAtual]}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{decimal.format(resultado.pesoAtual)}×</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(resultado.valorAtual)}</td>
            </tr>
            <tr className="border-t border-neutral-200 bg-if-green/5 font-medium dark:border-neutral-800">
              <td className="px-4 py-2.5">No cenário simulado</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{decimal.format(rapSimulada)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{ROTULO_FAIXA[resultado.faixaSimulada]}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{decimal.format(resultado.pesoSimulado)}×</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-if-green">{reais.format(resultado.valorSimulado)}</td>
            </tr>
            <tr className="border-t border-neutral-200 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <td className="px-4 py-2.5">Oficial (MDO)</td>
              <td className="px-4 py-2.5 text-right tabular-nums">não recalculado aqui</td>
              <td className="px-4 py-2.5 text-right tabular-nums">não recalculado aqui</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {inst.rapEqualizadoOficial !== null ? `${percentual.format(inst.rapEqualizadoOficial * 100)}%` : "não informado"}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(inst.vlRapOficial)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Estimativa: mantém o RAP das outras 41 instituições fixo e só reencaixa a instituição escolhida
        numa faixa hipotética. Na prática, se a RAP de uma instituição melhora, as outras não ficam
        paradas; o valor real dependeria de como a rede inteira mudou naquele ciclo.
      </p>
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
