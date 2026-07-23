"use client";

import { useEffect, useState } from "react";
import { TabelaDistribuicao, type CalculationRunDetail } from "@/components/distribuicao/TabelaDistribuicao";

interface DistribuicaoOficialResumo {
  ano: number;
  valorTotal: number;
  anoReferenciaPnp: number;
  runId: number | null;
  calculadoEm: string | null;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ConsultaPanel() {
  const [anos, setAnos] = useState<DistribuicaoOficialResumo[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);
  const [anoReferenciaSelecionado, setAnoReferenciaSelecionado] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<CalculationRunDetail | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/distribuicao-oficial")
      .then((response) => (response.ok ? (response.json() as Promise<DistribuicaoOficialResumo[]>) : []))
      .then(setAnos)
      .catch(() => setAnos([]));
  }, []);

  async function selecionarAno(resumo: DistribuicaoOficialResumo) {
    setAnoSelecionado(resumo.ano);
    setAnoReferenciaSelecionado(resumo.anoReferenciaPnp);
    setDetalhe(null);
    setErro(null);

    if (!resumo.runId) return;

    setCarregando(true);
    try {
      const response = await fetch(`/api/calculations/${resumo.runId}`);
      if (!response.ok) {
        const corpo = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(corpo?.error ?? "Não foi possível carregar a distribuição deste ano.");
      }
      setDetalhe((await response.json()) as CalculationRunDetail);
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Anos disponíveis</h2>
        {anos.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum orçamento anual foi configurado ainda pelo administrador.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {anos.map((resumo) => (
              <li key={resumo.ano}>
                <button
                  type="button"
                  onClick={() => selecionarAno(resumo)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    anoSelecionado === resumo.ano
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  }`}
                >
                  {resumo.ano} — {formatoMoeda.format(resumo.valorTotal)}
                  {!resumo.runId && ` (não calculado — usará dados PNP de ${resumo.anoReferenciaPnp})`}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {carregando && <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>}

      {erro && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
      )}

      {anoSelecionado !== null && !detalhe && !carregando && !erro && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          A distribuição oficial de {anoSelecionado} ainda não foi calculada pelo administrador. Quando calculada,
          usará os dados da PNP de {anoReferenciaSelecionado} (referência oficial: dois anos antes do orçamento).
        </p>
      )}

      {detalhe && (
        <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <TabelaDistribuicao detalhe={detalhe} />
        </div>
      )}
    </div>
  );
}
