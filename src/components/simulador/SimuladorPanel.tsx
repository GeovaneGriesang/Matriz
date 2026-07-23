"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";

interface UnidadeResultado {
  id: number;
  nome: string;
  funcionamentoValorReais: number;
  qualidadeEficienciaValorReais: number;
  subtotalReais: number;
}

interface InstituicaoResultado {
  id: number;
  sigla: string;
  nome: string;
  reitoriaValorReais: number;
  unidades: UnidadeResultado[];
  subtotalReais: number;
}

interface CalculationRunDetail {
  run: {
    id: number;
    status: string;
    ano: number | null;
    orcamentoTotal: number | null;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  };
  instituicoes: InstituicaoResultado[];
  totalGeralReais: number;
}

interface CalculationRunSummary {
  id: number;
  status: string;
  ano: number | null;
  orcamentoTotal: number | null;
  startedAt: string;
  finishedAt: string | null;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function SimuladorPanel() {
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [orcamentoTotal, setOrcamentoTotal] = useState("");
  const [ano, setAno] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<CalculationRunDetail | null>(null);
  const [execucoes, setExecucoes] = useState<CalculationRunSummary[]>([]);
  const [carregandoExecucao, setCarregandoExecucao] = useState<number | null>(null);

  function carregarExecucoes() {
    fetch("/api/calculations")
      .then((response) => (response.ok ? (response.json() as Promise<CalculationRunSummary[]>) : []))
      .then(setExecucoes)
      .catch(() => {
        // Falha ao listar histórico não deve travar a tela do simulador.
      });
  }

  useEffect(() => {
    fetch("/api/fatos/anos")
      .then((response) => (response.ok ? (response.json() as Promise<number[]>) : []))
      .then((anos) => {
        setAnosDisponiveis(anos);
        if (anos.length > 0) setAno(String(anos[0]));
      })
      .catch(() => {
        // Sem anos disponíveis, o campo cai para entrada manual.
      });
    carregarExecucoes();
  }, []);

  async function abrirExecucao(id: number) {
    setCarregandoExecucao(id);
    setErro(null);
    try {
      const response = await fetch(`/api/calculations/${id}`);
      if (!response.ok) {
        const corpo = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(corpo?.error ?? "Não foi possível carregar essa execução.");
      }
      setDetalhe((await response.json()) as CalculationRunDetail);
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCarregandoExecucao(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCalculando(true);
    setDetalhe(null);

    try {
      const response = await fetch("/api/calculations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orcamentoTotal: Number(orcamentoTotal), ano: Number(ano) }),
      });
      const corpo = (await response.json().catch(() => null)) as { error?: string; runId?: number } | null;
      if (!response.ok || !corpo?.runId) {
        throw new Error(corpo?.error ?? "Não foi possível calcular a distribuição.");
      }

      await abrirExecucao(corpo.runId);
      carregarExecucoes();
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="orcamentoTotal" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Orçamento total (R$)
          </label>
          <input
            id="orcamentoTotal"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={orcamentoTotal}
            onChange={(e) => setOrcamentoTotal(e.target.value)}
            disabled={calculando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ano" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Ano de referência
          </label>
          {anosDisponiveis.length > 0 ? (
            <select
              id="ano"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              disabled={calculando}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {anosDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="ano"
              type="number"
              step="1"
              required
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              disabled={calculando}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          )}
          {anosDisponiveis.length === 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Nenhum dado importado ainda — digite o ano manualmente.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={calculando}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {calculando ? "Calculando..." : "Simular"}
        </button>

        {erro && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
        )}
      </form>

      {detalhe && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Execução #{detalhe.run.id} — ano {detalhe.run.ano ?? "?"}
            </h2>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Orçamento simulado:{" "}
              {detalhe.run.orcamentoTotal !== null ? formatoMoeda.format(detalhe.run.orcamentoTotal) : "—"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  <th className="py-2 pr-4">Instituição / Câmpus</th>
                  <th className="py-2 pr-4 text-right">Reitoria</th>
                  <th className="py-2 pr-4 text-right">Funcionamento</th>
                  <th className="py-2 pr-4 text-right">Qualidade e Eficiência</th>
                  <th className="py-2 pr-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.instituicoes.map((instituicao) => (
                  <Fragment key={`instituicao-frag-${instituicao.id}`}>
                    <tr
                      key={`instituicao-${instituicao.id}`}
                      className="border-b border-neutral-100 font-medium text-neutral-900 dark:border-neutral-900 dark:text-neutral-100"
                    >
                      <td className="py-2 pr-4">
                        {instituicao.sigla} — {instituicao.nome}
                      </td>
                      <td className="py-2 pr-4 text-right">{formatoMoeda.format(instituicao.reitoriaValorReais)}</td>
                      <td className="py-2 pr-4 text-right">—</td>
                      <td className="py-2 pr-4 text-right">—</td>
                      <td className="py-2 pr-4 text-right">{formatoMoeda.format(instituicao.subtotalReais)}</td>
                    </tr>
                    {instituicao.unidades.map((unidade) => (
                      <tr
                        key={`unidade-${unidade.id}`}
                        className="border-b border-neutral-100 text-neutral-700 dark:border-neutral-900 dark:text-neutral-300"
                      >
                        <td className="py-1.5 pr-4 pl-6">{unidade.nome}</td>
                        <td className="py-1.5 pr-4 text-right">—</td>
                        <td className="py-1.5 pr-4 text-right">
                          {formatoMoeda.format(unidade.funcionamentoValorReais)}
                        </td>
                        <td className="py-1.5 pr-4 text-right">
                          {formatoMoeda.format(unidade.qualidadeEficienciaValorReais)}
                        </td>
                        <td className="py-1.5 pr-4 text-right">{formatoMoeda.format(unidade.subtotalReais)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-neutral-900 dark:text-neutral-100">
                  <td className="pt-3 pr-4">Total geral</td>
                  <td className="pt-3 pr-4" />
                  <td className="pt-3 pr-4" />
                  <td className="pt-3 pr-4" />
                  <td className="pt-3 pr-4 text-right">{formatoMoeda.format(detalhe.totalGeralReais)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Execuções anteriores</h2>
        {execucoes.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma execução registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {execucoes.map((execucao) => (
              <li key={execucao.id}>
                <button
                  type="button"
                  onClick={() => abrirExecucao(execucao.id)}
                  disabled={carregandoExecucao === execucao.id}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-900"
                >
                  <span>
                    #{execucao.id} — ano {execucao.ano ?? "?"} —{" "}
                    {execucao.orcamentoTotal !== null ? formatoMoeda.format(execucao.orcamentoTotal) : "—"}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatoData.format(new Date(execucao.startedAt))} · {execucao.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
