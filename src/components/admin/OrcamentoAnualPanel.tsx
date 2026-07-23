"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { salvarOrcamentoAnualAction, calcularDistribuicaoOficialAction } from "@/server/actions/orcamentoAnual";

interface OrcamentoAnual {
  ano: number;
  valorTotal: number;
  updatedAt: string;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function OrcamentoAnualPanel() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoAnual[]>([]);
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [valorTotal, setValorTotal] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [calculandoAno, setCalculandoAno] = useState<number | null>(null);
  const [mensagemPorAno, setMensagemPorAno] = useState<Record<number, string>>({});

  function carregarOrcamentos() {
    fetch("/api/orcamentos-anuais")
      .then((response) => (response.ok ? (response.json() as Promise<OrcamentoAnual[]>) : []))
      .then(setOrcamentos)
      .catch(() => {
        // Falha pontual ao listar não deve travar a tela.
      });
  }

  useEffect(carregarOrcamentos, []);

  async function handleSalvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const formData = new FormData(event.currentTarget);
      const resultado = await salvarOrcamentoAnualAction(formData);
      if (!resultado.ok) {
        throw new Error(resultado.errorMessage ?? "Não foi possível salvar o orçamento.");
      }
      setValorTotal(0);
      carregarOrcamentos();
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleCalcularOficial(anoAlvo: number) {
    setCalculandoAno(anoAlvo);
    setMensagemPorAno((atual) => ({ ...atual, [anoAlvo]: "" }));

    try {
      const formData = new FormData();
      formData.set("ano", String(anoAlvo));
      const resultado = await calcularDistribuicaoOficialAction(formData);
      if (!resultado.ok) {
        throw new Error(resultado.errorMessage ?? "Não foi possível calcular a distribuição oficial.");
      }
      setMensagemPorAno((atual) => ({ ...atual, [anoAlvo]: `Calculado — execução #${resultado.runId}.` }));
    } catch (error) {
      setMensagemPorAno((atual) => ({ ...atual, [anoAlvo]: (error as Error).message }));
    } finally {
      setCalculandoAno(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSalvar}
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="ano" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Ano
          </label>
          <input
            id="ano"
            name="ano"
            type="number"
            step="1"
            required
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            disabled={salvando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          {Number.isInteger(Number(ano)) && Number(ano) > 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              O cálculo oficial deste orçamento usará os dados da PNP de {Number(ano) - 2} (dois anos antes, regra
              oficial da PNP).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="valorTotal" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Orçamento total do ano (R$)
          </label>
          <CurrencyInput
            id="valorTotal"
            name="valorTotal"
            value={valorTotal}
            onChange={setValorTotal}
            disabled={salvando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </div>

        <button
          type="submit"
          disabled={salvando}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {salvando ? "Salvando..." : "Salvar orçamento do ano"}
        </button>

        {erro && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
        )}
      </form>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Anos configurados</h2>
        {orcamentos.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum orçamento anual cadastrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {orcamentos.map((o) => (
              <li
                key={o.ano}
                className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {o.ano} — {formatoMoeda.format(o.valorTotal)}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Atualizado em {formatoData.format(new Date(o.updatedAt))}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Referência PNP: dados de {o.ano - 2}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCalcularOficial(o.ano)}
                    disabled={calculandoAno === o.ano}
                    className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {calculandoAno === o.ano ? "Calculando..." : "Calcular distribuição oficial"}
                  </button>
                  <Link
                    href="/consulta"
                    className="text-xs font-medium text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  >
                    Ver no /consulta
                  </Link>
                </div>
                {mensagemPorAno[o.ano] && (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">{mensagemPorAno[o.ano]}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
