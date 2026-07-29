"use client";

import { useEffect, useState } from "react";
import { TabelaDistribuicao, type CalculationRunDetail } from "@/components/distribuicao/TabelaDistribuicao";
import { TabelaComparativoInteranual } from "@/components/distribuicao/TabelaComparativoInteranual";
import { apiUrl } from "@/lib/basePath";

interface DistribuicaoOficialResumo {
  ano: number;
  valorTotal: number;
  valorAssistenciaEstudantil: number;
  anoReferenciaPnp: number;
  runId: number | null;
  calculadoEm: string | null;
  escopo: "CONIF" | "TODAS" | null;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_ESCOPO: Record<"CONIF" | "TODAS", string> = {
  CONIF: "CONIF",
  TODAS: "todas as instituições federais",
};

async function buscarCalculationRunDetail(runId: number): Promise<CalculationRunDetail> {
  const response = await fetch(apiUrl(`/api/calculations/${runId}`));
  if (!response.ok) {
    const corpo = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(corpo?.error ?? "Não foi possível carregar a distribuição deste ano.");
  }
  return (await response.json()) as CalculationRunDetail;
}

export function ConsultaPanel() {
  const [anos, setAnos] = useState<DistribuicaoOficialResumo[]>([]);
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(null);
  const [anoReferenciaSelecionado, setAnoReferenciaSelecionado] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<CalculationRunDetail | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [compararAtivo, setCompararAtivo] = useState(false);
  const [anoComparacaoAnterior, setAnoComparacaoAnterior] = useState<number | null>(null);
  const [anoComparacaoAtual, setAnoComparacaoAtual] = useState<number | null>(null);
  const [detalheComparativoAnterior, setDetalheComparativoAnterior] = useState<CalculationRunDetail | null>(null);
  const [detalheComparativoAtual, setDetalheComparativoAtual] = useState<CalculationRunDetail | null>(null);
  const [carregandoComparativo, setCarregandoComparativo] = useState(false);
  const [erroComparativo, setErroComparativo] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/distribuicao-oficial"))
      .then((response) => (response.ok ? (response.json() as Promise<DistribuicaoOficialResumo[]>) : []))
      .then(setAnos)
      .catch(() => setAnos([]));
  }, []);

  const anosCalculados = anos.filter((a) => a.runId !== null);

  useEffect(() => {
    if (compararAtivo && anoComparacaoAnterior === null && anoComparacaoAtual === null && anosCalculados.length >= 2) {
      setAnoComparacaoAtual(anosCalculados[0]?.ano ?? null);
      setAnoComparacaoAnterior(anosCalculados[1]?.ano ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compararAtivo, anos]);

  useEffect(() => {
    if (
      !compararAtivo ||
      anoComparacaoAnterior === null ||
      anoComparacaoAtual === null ||
      anoComparacaoAnterior === anoComparacaoAtual
    ) {
      return;
    }
    const resumoAnterior = anos.find((a) => a.ano === anoComparacaoAnterior);
    const resumoAtual = anos.find((a) => a.ano === anoComparacaoAtual);
    if (!resumoAnterior?.runId || !resumoAtual?.runId) return;

    let cancelado = false;
    setCarregandoComparativo(true);
    setErroComparativo(null);
    setDetalheComparativoAnterior(null);
    setDetalheComparativoAtual(null);

    Promise.all([buscarCalculationRunDetail(resumoAnterior.runId), buscarCalculationRunDetail(resumoAtual.runId)])
      .then(([detAnterior, detAtual]) => {
        if (cancelado) return;
        setDetalheComparativoAnterior(detAnterior);
        setDetalheComparativoAtual(detAtual);
      })
      .catch((error) => {
        if (!cancelado) setErroComparativo((error as Error).message);
      })
      .finally(() => {
        if (!cancelado) setCarregandoComparativo(false);
      });

    return () => {
      cancelado = true;
    };
  }, [compararAtivo, anoComparacaoAnterior, anoComparacaoAtual, anos]);

  async function selecionarAno(resumo: DistribuicaoOficialResumo) {
    setAnoSelecionado(resumo.ano);
    setAnoReferenciaSelecionado(resumo.anoReferenciaPnp);
    setDetalhe(null);
    setErro(null);

    if (!resumo.runId) return;

    setCarregando(true);
    try {
      setDetalhe(await buscarCalculationRunDetail(resumo.runId));
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  function alternarComparar(ativo: boolean) {
    setCompararAtivo(ativo);
    setErroComparativo(null);
    if (!ativo) {
      setDetalheComparativoAnterior(null);
      setDetalheComparativoAtual(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Anos disponíveis</h2>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={compararAtivo}
              onChange={(e) => alternarComparar(e.target.checked)}
            />
            Comparar com outro ano
          </label>
        </div>

        {!compararAtivo ? (
          anos.length === 0 ? (
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
                    {resumo.ano} — Custeio (20RL): {formatoMoeda.format(resumo.valorTotal)} · Assist. Estudantil
                    (2994): {formatoMoeda.format(resumo.valorAssistenciaEstudantil)}
                    {resumo.runId
                      ? resumo.escopo && ` (${ROTULO_ESCOPO[resumo.escopo]})`
                      : ` (não calculado — usará dados PNP de ${resumo.anoReferenciaPnp})`}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : anosCalculados.length < 2 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            É preciso pelo menos dois anos com distribuição oficial já calculada para comparar.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="anoComparacaoAnterior" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Ano de comparação (anterior/histórico)
              </label>
              <select
                id="anoComparacaoAnterior"
                value={anoComparacaoAnterior ?? ""}
                onChange={(e) => setAnoComparacaoAnterior(Number(e.target.value))}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {anosCalculados.map((a) => (
                  <option key={a.ano} value={a.ano}>
                    {a.ano}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="anoComparacaoAtual" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Ano de referência (atual)
              </label>
              <select
                id="anoComparacaoAtual"
                value={anoComparacaoAtual ?? ""}
                onChange={(e) => setAnoComparacaoAtual(Number(e.target.value))}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {anosCalculados.map((a) => (
                  <option key={a.ano} value={a.ano}>
                    {a.ano}
                  </option>
                ))}
              </select>
            </div>
            {anoComparacaoAnterior !== null && anoComparacaoAtual !== null && anoComparacaoAnterior === anoComparacaoAtual && (
              <p className="text-sm text-amber-700 dark:text-amber-300">Selecione dois anos diferentes.</p>
            )}
          </div>
        )}
      </div>

      {!compararAtivo ? (
        <>
          {carregando && <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>}

          {erro && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
          )}

          {anoSelecionado !== null && !detalhe && !carregando && !erro && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              A distribuição oficial de {anoSelecionado} ainda não foi calculada pelo administrador. Quando
              calculada, usará os dados da PNP de {anoReferenciaSelecionado} (referência oficial: dois anos antes do
              orçamento).
            </p>
          )}

          {detalhe && (
            <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
              <TabelaDistribuicao detalhe={detalhe} />
            </div>
          )}
        </>
      ) : (
        <>
          {carregandoComparativo && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando comparativo...</p>
          )}

          {erroComparativo && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
              {erroComparativo}
            </p>
          )}

          {detalheComparativoAnterior && detalheComparativoAtual && (
            <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
              <TabelaComparativoInteranual
                detalheAnterior={detalheComparativoAnterior}
                detalheAtual={detalheComparativoAtual}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
