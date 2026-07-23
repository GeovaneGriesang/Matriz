"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { TabelaDistribuicao, type CalculationRunDetail } from "@/components/distribuicao/TabelaDistribuicao";

interface CalculationRunSummary {
  id: number;
  status: string;
  origem: string;
  ano: number | null;
  orcamentoTotal: number | null;
  startedAt: string;
  finishedAt: string | null;
}

interface Instituicao {
  id: number;
  sigla: string;
  nome: string;
}

interface Unidade {
  id: number;
  nome: string;
}

interface CampusOverrideCampos {
  matriculaPonderada?: number;
  valorIeaPercentual?: number;
  razaoDocenteAluno?: number;
  matriculasTecnicos?: number;
  matriculasFormacaoProfessores?: number;
  matriculasProeja?: number;
}

interface AjusteCampus {
  unidadeId: number;
  unidadeNome: string;
  instituicaoSigla: string;
  campos: CampusOverrideCampos;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const ROTULO_CAMPO: Record<keyof CampusOverrideCampos, string> = {
  matriculaPonderada: "Matrícula Ponderada",
  valorIeaPercentual: "IEA",
  razaoDocenteAluno: "RAP",
  matriculasTecnicos: "Matrículas Técnicos",
  matriculasFormacaoProfessores: "Matrículas Formação Prof.",
  matriculasProeja: "Matrículas Proeja",
};

function resumirAjuste(ajuste: AjusteCampus): string {
  const partes = (Object.keys(ajuste.campos) as (keyof CampusOverrideCampos)[]).map(
    (campo) => `${ROTULO_CAMPO[campo]}=${ajuste.campos[campo]}`,
  );
  return `${ajuste.instituicaoSigla} — ${ajuste.unidadeNome}: ${partes.join(", ")}`;
}

export function SimuladorPanel() {
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [orcamentoTotal, setOrcamentoTotal] = useState(0);
  const [ano, setAno] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<CalculationRunDetail | null>(null);
  const [execucoes, setExecucoes] = useState<CalculationRunSummary[]>([]);
  const [carregandoExecucao, setCarregandoExecucao] = useState<number | null>(null);

  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [instituicaoSelecionada, setInstituicaoSelecionada] = useState("");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("");
  const [camposAjuste, setCamposAjuste] = useState<Record<keyof CampusOverrideCampos, string>>({
    matriculaPonderada: "",
    valorIeaPercentual: "",
    razaoDocenteAluno: "",
    matriculasTecnicos: "",
    matriculasFormacaoProfessores: "",
    matriculasProeja: "",
  });
  const [ajustes, setAjustes] = useState<AjusteCampus[]>([]);

  function carregarExecucoes() {
    fetch("/api/calculations")
      .then((response) => (response.ok ? (response.json() as Promise<CalculationRunSummary[]>) : []))
      .then((lista) => setExecucoes(lista.filter((e) => e.origem === "SIMULACAO")))
      .catch(() => {
        // Falha pontual de polling não deve travar a tela.
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
    fetch("/api/instituicoes")
      .then((response) => (response.ok ? (response.json() as Promise<Instituicao[]>) : []))
      .then(setInstituicoes)
      .catch(() => {
        // Sem instituições carregadas, a seção de ajustes fica vazia.
      });
    carregarExecucoes();
  }, []);

  useEffect(() => {
    if (!instituicaoSelecionada) {
      setUnidades([]);
      setUnidadeSelecionada("");
      return;
    }
    fetch(`/api/instituicoes/${instituicaoSelecionada}/unidades`)
      .then((response) => (response.ok ? (response.json() as Promise<Unidade[]>) : []))
      .then(setUnidades)
      .catch(() => setUnidades([]));
  }, [instituicaoSelecionada]);

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

  function adicionarAjuste() {
    if (!unidadeSelecionada) return;
    const campos: CampusOverrideCampos = {};
    for (const chave of Object.keys(camposAjuste) as (keyof CampusOverrideCampos)[]) {
      const valor = camposAjuste[chave];
      if (valor.trim() !== "" && Number.isFinite(Number(valor))) {
        campos[chave] = Number(valor);
      }
    }
    if (Object.keys(campos).length === 0) return;

    const unidade = unidades.find((u) => String(u.id) === unidadeSelecionada);
    const instituicao = instituicoes.find((i) => String(i.id) === instituicaoSelecionada);
    if (!unidade) return;

    const novoAjuste: AjusteCampus = {
      unidadeId: unidade.id,
      unidadeNome: unidade.nome,
      instituicaoSigla: instituicao?.sigla ?? "",
      campos,
    };

    setAjustes((atuais) => [...atuais.filter((a) => a.unidadeId !== unidade.id), novoAjuste]);
    setCamposAjuste({
      matriculaPonderada: "",
      valorIeaPercentual: "",
      razaoDocenteAluno: "",
      matriculasTecnicos: "",
      matriculasFormacaoProfessores: "",
      matriculasProeja: "",
    });
  }

  function removerAjuste(unidadeId: number) {
    setAjustes((atuais) => atuais.filter((a) => a.unidadeId !== unidadeId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCalculando(true);
    setDetalhe(null);

    const overridesPorUnidade: Record<number, CampusOverrideCampos> = {};
    for (const ajuste of ajustes) {
      overridesPorUnidade[ajuste.unidadeId] = ajuste.campos;
    }

    if (!instituicaoSelecionada) {
      setErro("Selecione a instituição para a qual o orçamento informado será distribuído.");
      setCalculando(false);
      return;
    }

    try {
      const response = await fetch("/api/calculations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instituicaoId: Number(instituicaoSelecionada),
          orcamentoTotal,
          ano: Number(ano),
          overridesPorUnidade,
        }),
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

  const inputClass =
    "rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="instituicao" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Instituição
          </label>
          <select
            id="instituicao"
            required
            value={instituicaoSelecionada}
            onChange={(e) => setInstituicaoSelecionada(e.target.value)}
            disabled={calculando}
            className={inputClass}
          >
            <option value="">Selecione...</option>
            {instituicoes.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sigla} — {i.nome}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            O orçamento informado abaixo é distribuído só entre os câmpus desta instituição.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="orcamentoTotal" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Orçamento total (R$)
          </label>
          <CurrencyInput
            id="orcamentoTotal"
            value={orcamentoTotal}
            onChange={setOrcamentoTotal}
            disabled={calculando}
            className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
            />
          )}
          {anosDisponiveis.length === 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Nenhum dado importado ainda — digite o ano manualmente.
            </p>
          )}
        </div>

        <details className="rounded-md border border-neutral-200 dark:border-neutral-800">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Ajustes por câmpus (opcional) — teste "e se" mudando um indicador específico
          </summary>
          <div className="flex flex-col gap-3 border-t border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">Câmpus</label>
              <select
                value={unidadeSelecionada}
                onChange={(e) => setUnidadeSelecionada(e.target.value)}
                disabled={!instituicaoSelecionada || unidades.length === 0}
                className={inputClass}
              >
                <option value="">
                  {instituicaoSelecionada ? "Selecione..." : "Selecione uma instituição acima primeiro"}
                </option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.keys(ROTULO_CAMPO) as (keyof CampusOverrideCampos)[]).map((campo) => (
                <div key={campo} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                    {ROTULO_CAMPO[campo]}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={camposAjuste[campo]}
                    onChange={(e) => setCamposAjuste((atuais) => ({ ...atuais, [campo]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={adicionarAjuste}
              disabled={!unidadeSelecionada}
              className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Adicionar ajuste
            </button>

            {ajustes.length > 0 && (
              <ul className="flex flex-col gap-1">
                {ajustes.map((ajuste) => (
                  <li
                    key={ajuste.unidadeId}
                    className="flex items-center justify-between gap-2 rounded-md bg-neutral-100 px-3 py-1.5 text-xs dark:bg-neutral-800"
                  >
                    <span>{resumirAjuste(ajuste)}</span>
                    <button
                      type="button"
                      onClick={() => removerAjuste(ajuste.unidadeId)}
                      className="font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

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
        <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
          <TabelaDistribuicao detalhe={detalhe} />
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Simulações anteriores</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Distribuições oficiais (definidas pelo administrador) ficam na tela de Consulta, não aqui.
        </p>
        {execucoes.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma simulação registrada ainda.</p>
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
