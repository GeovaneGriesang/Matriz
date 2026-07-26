"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { TabelaDistribuicao, type CalculationRunDetail } from "@/components/distribuicao/TabelaDistribuicao";
import { ConsultaPanel } from "@/components/consulta/ConsultaPanel";

type Escopo = "CONIF" | "TODAS";

interface CalculationRunSummary {
  id: number;
  status: string;
  origem: string;
  ano: number | null;
  orcamentoTotal: number | null;
  orcamentoAssistenciaEstudantil: number | null;
  percentualAnuidade: number | null;
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

/** Campos deste tipo continuam apurados e simulados por câmpus (Matrícula/Funcionamento e IAPL). */
type CampoPorCampus = Exclude<keyof CampusOverrideCampos, "valorIeaPercentual" | "razaoDocenteAluno">;

interface AjusteCampus {
  unidadeId: number;
  unidadeNome: string;
  instituicaoSigla: string;
  campos: Pick<CampusOverrideCampos, CampoPorCampus>;
}

/** IEA e RAP só são apurados em nível de instituição (Portaria SETEC/MEC nº 51/2018 e Guia de
 * Referência Metodológica da PNP) — o ajuste é por instituição inteira, não por câmpus. */
interface AjusteInstituicao {
  instituicaoId: number;
  instituicaoSigla: string;
  /** Câmpus usado só como chave técnica para enviar o override ao backend — o efeito é sempre na instituição inteira. */
  unidadeIdReferencia: number;
  valorIeaPercentual?: number;
  razaoDocenteAluno?: number;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const ROTULO_CAMPO_POR_CAMPUS: Record<CampoPorCampus, string> = {
  matriculaPonderada: "Matrícula Ponderada",
  matriculasTecnicos: "Matrículas Técnicos",
  matriculasFormacaoProfessores: "Matrículas Formação Prof.",
  matriculasProeja: "Matrículas Proeja",
};

function resumirAjuste(ajuste: AjusteCampus): string {
  const partes = (Object.keys(ajuste.campos) as CampoPorCampus[]).map(
    (campo) => `${ROTULO_CAMPO_POR_CAMPUS[campo]}=${ajuste.campos[campo]}`,
  );
  return `${ajuste.instituicaoSigla} — ${ajuste.unidadeNome}: ${partes.join(", ")}`;
}

function resumirAjusteInstituicao(ajuste: AjusteInstituicao): string {
  const partes: string[] = [];
  if (ajuste.valorIeaPercentual !== undefined) partes.push(`IEA=${ajuste.valorIeaPercentual}`);
  if (ajuste.razaoDocenteAluno !== undefined) partes.push(`RAP=${ajuste.razaoDocenteAluno}`);
  return `${ajuste.instituicaoSigla} (instituição inteira): ${partes.join(", ")}`;
}

export function SimuladorPanel() {
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [orcamentoTotal, setOrcamentoTotal] = useState(0);
  const [orcamentoAssistenciaEstudantil, setOrcamentoAssistenciaEstudantil] = useState(0);
  const [percentualAnuidade, setPercentualAnuidade] = useState("0");
  const [ano, setAno] = useState("");
  const [escopo, setEscopo] = useState<Escopo>("CONIF");
  const [instituicaoFiltro, setInstituicaoFiltro] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<CalculationRunDetail | null>(null);
  const [execucoes, setExecucoes] = useState<CalculationRunSummary[]>([]);
  const [carregandoExecucao, setCarregandoExecucao] = useState<number | null>(null);

  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [instituicaoAjusteSelecionada, setInstituicaoAjusteSelecionada] = useState("");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("");
  const [camposAjuste, setCamposAjuste] = useState<Record<CampoPorCampus, string>>({
    matriculaPonderada: "",
    matriculasTecnicos: "",
    matriculasFormacaoProfessores: "",
    matriculasProeja: "",
  });
  const [ajustes, setAjustes] = useState<AjusteCampus[]>([]);

  const [instituicaoQeESelecionada, setInstituicaoQeESelecionada] = useState("");
  const [valorIeaPercentualQeE, setValorIeaPercentualQeE] = useState("");
  const [razaoDocenteAlunoQeE, setRazaoDocenteAlunoQeE] = useState("");
  const [ajustesInstituicao, setAjustesInstituicao] = useState<AjusteInstituicao[]>([]);
  const [erroAjusteInstituicao, setErroAjusteInstituicao] = useState<string | null>(null);

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
    if (!instituicaoAjusteSelecionada) {
      setUnidades([]);
      setUnidadeSelecionada("");
      return;
    }
    fetch(`/api/instituicoes/${instituicaoAjusteSelecionada}/unidades`)
      .then((response) => (response.ok ? (response.json() as Promise<Unidade[]>) : []))
      .then(setUnidades)
      .catch(() => setUnidades([]));
  }, [instituicaoAjusteSelecionada]);

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
    const campos: Pick<CampusOverrideCampos, CampoPorCampus> = {};
    for (const chave of Object.keys(camposAjuste) as CampoPorCampus[]) {
      const valor = camposAjuste[chave];
      if (valor.trim() !== "" && Number.isFinite(Number(valor))) {
        campos[chave] = Number(valor);
      }
    }
    if (Object.keys(campos).length === 0) return;

    const unidade = unidades.find((u) => String(u.id) === unidadeSelecionada);
    const instituicao = instituicoes.find((i) => String(i.id) === instituicaoAjusteSelecionada);
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
      matriculasTecnicos: "",
      matriculasFormacaoProfessores: "",
      matriculasProeja: "",
    });
  }

  function removerAjuste(unidadeId: number) {
    setAjustes((atuais) => atuais.filter((a) => a.unidadeId !== unidadeId));
  }

  async function adicionarAjusteInstituicao() {
    setErroAjusteInstituicao(null);
    if (!instituicaoQeESelecionada) return;

    const campos: Pick<CampusOverrideCampos, "valorIeaPercentual" | "razaoDocenteAluno"> = {};
    if (valorIeaPercentualQeE.trim() !== "" && Number.isFinite(Number(valorIeaPercentualQeE))) {
      campos.valorIeaPercentual = Number(valorIeaPercentualQeE);
    }
    if (razaoDocenteAlunoQeE.trim() !== "" && Number.isFinite(Number(razaoDocenteAlunoQeE))) {
      campos.razaoDocenteAluno = Number(razaoDocenteAlunoQeE);
    }
    if (Object.keys(campos).length === 0) return;

    const instituicao = instituicoes.find((i) => String(i.id) === instituicaoQeESelecionada);
    if (!instituicao) return;

    // IEA/RAP são apurados por instituição (ver calcularBlocoIea.ts/calcularBlocoRap.ts), mas o
    // backend ainda indexa CampusOverride por unidadeId (overridesPorUnidade: Record<number, ...>)
    // — precisamos de ALGUM câmpus da instituição só como "chave de transporte" pra chegar até lá;
    // o valor em si (unidadeIdReferencia) nunca é usado como câmpus real, só resolvido de volta pra
    // instituicaoId no servidor (ver construirOverridesIea/construirOverridesRap em runCalculation.ts).
    //
    // Critério: o PRIMEIRO item de `/api/instituicoes/{id}/unidades`, que ordena por
    // `nome: "asc"` (ver src/app/api/instituicoes/[id]/unidades/route.ts) — ou seja, o câmpus cujo
    // nome vem primeiro em ordem alfabética. É determinístico: como `Unidade` tem nome único dentro
    // da instituição (`@@unique([instituicaoId, nome])`), essa ordenação não tem empate, então a
    // mesma instituição sempre resolve para o mesmo câmpus, independente de quando ou quantas vezes
    // a simulação rodar — muda só se o roster de câmpus da instituição mudar (câmpus novo cujo nome
    // vem antes na ordem alfabética, por exemplo), nunca por acaso.
    try {
      const response = await fetch(`/api/instituicoes/${instituicao.id}/unidades`);
      const lista = response.ok ? ((await response.json()) as Unidade[]) : [];
      const unidadeReferencia = lista[0];
      if (!unidadeReferencia) {
        // Instituição sem nenhum câmpus cadastrado (raro — só ocorre se ela nunca apareceu em
        // nenhuma linha de nível-câmpus de nenhum arquivo já ingerido): não há como simular
        // IEA/RAP para ela por falta de uma chave de transporte, então o ajuste não é adicionado
        // e o erro fica visível pro usuário — nunca falha silenciosamente nem quebra a tela.
        setErroAjusteInstituicao(`A instituição ${instituicao.sigla} não tem nenhum câmpus cadastrado.`);
        return;
      }
      const novoAjuste: AjusteInstituicao = {
        instituicaoId: instituicao.id,
        instituicaoSigla: instituicao.sigla,
        unidadeIdReferencia: unidadeReferencia.id,
        ...campos,
      };
      setAjustesInstituicao((atuais) => [
        ...atuais.filter((a) => a.instituicaoId !== instituicao.id),
        novoAjuste,
      ]);
      setValorIeaPercentualQeE("");
      setRazaoDocenteAlunoQeE("");
    } catch {
      setErroAjusteInstituicao("Não foi possível carregar os câmpus dessa instituição.");
    }
  }

  function removerAjusteInstituicao(instituicaoId: number) {
    setAjustesInstituicao((atuais) => atuais.filter((a) => a.instituicaoId !== instituicaoId));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setCalculando(true);
    setDetalhe(null);

    const overridesPorUnidade: Record<number, CampusOverrideCampos> = {};
    for (const ajuste of ajustes) {
      overridesPorUnidade[ajuste.unidadeId] = { ...overridesPorUnidade[ajuste.unidadeId], ...ajuste.campos };
    }
    for (const ajusteInstituicao of ajustesInstituicao) {
      const { instituicaoId, instituicaoSigla, unidadeIdReferencia, ...campos } = ajusteInstituicao;
      overridesPorUnidade[unidadeIdReferencia] = { ...overridesPorUnidade[unidadeIdReferencia], ...campos };
    }

    try {
      const response = await fetch("/api/calculations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          escopo,
          instituicaoId: instituicaoFiltro ? Number(instituicaoFiltro) : undefined,
          orcamentoTotal,
          orcamentoAssistenciaEstudantil,
          percentualAnuidade: Number(percentualAnuidade) || 0,
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
    <div className="flex flex-col gap-8">
      <ConsultaPanel />

      <div className="flex flex-col gap-4 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Simular com outros valores</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Teste um orçamento, escopo e ano diferentes. O resultado é só uma simulação — não altera nem aparece na
            tela de Consulta, que mostra apenas o que o administrador calculou oficialmente.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Escopo</legend>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="escopo"
                  checked={escopo === "CONIF"}
                  onChange={() => setEscopo("CONIF")}
                  disabled={calculando}
                />
                CONIF (41 instituições)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="escopo"
                  checked={escopo === "TODAS"}
                  onChange={() => setEscopo("TODAS")}
                  disabled={calculando}
                />
                Todas as instituições federais (64)
              </label>
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor="instituicaoFiltro" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Instituição (opcional) — restringe a simulação a essa instituição
            </label>
            <select
              id="instituicaoFiltro"
              value={instituicaoFiltro}
              onChange={(e) => setInstituicaoFiltro(e.target.value)}
              disabled={calculando}
              className={inputClass}
            >
              <option value="">Todas do escopo selecionado acima</option>
              {instituicoes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sigla} — {i.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {instituicaoFiltro
                ? "O orçamento abaixo será distribuído só entre os câmpus dessa instituição."
                : "Deixe em \"Todas do escopo\" para distribuir entre todas as instituições do Escopo escolhido."}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="orcamentoTotal" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Orçamento Total de Custeio e Funcionamento (Ação 20RL) [R$] — soma de{" "}
              {instituicaoFiltro ? "toda a instituição selecionada" : "todo o escopo"}
            </label>
            <CurrencyInput
              id="orcamentoTotal"
              value={orcamentoTotal}
              onChange={setOrcamentoTotal}
              disabled={calculando}
              className={inputClass}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Separado automaticamente em 80% Funcionamento (por câmpus), 10% Reitorias (por instituição) e 10%
              Qualidade e Eficiência (IEA/RAP/IAPL). A Ação 2994 abaixo é calculada de forma independente.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="orcamentoAssistenciaEstudantil"
              className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
            >
              Orçamento de Assistência Estudantil (Ação 2994 / PNAES) [R$]
            </label>
            <CurrencyInput
              id="orcamentoAssistenciaEstudantil"
              value={orcamentoAssistenciaEstudantil}
              onChange={setOrcamentoAssistenciaEstudantil}
              disabled={calculando}
              className={inputClass}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Isolado do Custeio 20RL acima — rateado por faixa de Renda Familiar Per Capita (RFP) por instituição
              e depois subdividido entre os câmpus pela Matrícula Ponderada. Opcional aqui: fica em R$ 0,00 se
              você quiser simular só o Custeio 20RL.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="percentualAnuidade" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Percentual de Anuidade CONIF [%]
            </label>
            <input
              id="percentualAnuidade"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percentualAnuidade}
              onChange={(e) => setPercentualAnuidade(e.target.value)}
              disabled={calculando}
              className={inputClass}
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Calculado sobre o Custeio (20RL) já distribuído de cada instituição — informativo, não é deduzido do
              que ela recebe. Deixe em 0% para não simular anuidade.
            </p>
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
              Ajustes por câmpus (opcional) — teste "e se" mudando Matrícula ou IAPL de um câmpus específico
            </summary>
            <div className="flex flex-col gap-3 border-t border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">Instituição</label>
                <select
                  value={instituicaoAjusteSelecionada}
                  onChange={(e) => setInstituicaoAjusteSelecionada(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione...</option>
                  {instituicoes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sigla} — {i.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">Câmpus</label>
                <select
                  value={unidadeSelecionada}
                  onChange={(e) => setUnidadeSelecionada(e.target.value)}
                  disabled={!instituicaoAjusteSelecionada || unidades.length === 0}
                  className={inputClass}
                >
                  <option value="">
                    {instituicaoAjusteSelecionada ? "Selecione..." : "Selecione uma instituição acima primeiro"}
                  </option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(Object.keys(ROTULO_CAMPO_POR_CAMPUS) as CampoPorCampus[]).map((campo) => (
                  <div key={campo} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      {ROTULO_CAMPO_POR_CAMPUS[campo]}
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

          <details className="rounded-md border border-neutral-200 dark:border-neutral-800">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Ajustes de IEA e RAP (opcional) — teste "e se" mudando um indicador de uma instituição inteira
            </summary>
            <div className="flex flex-col gap-3 border-t border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                IEA e RAP são calculados oficialmente no nível da instituição (Portaria SETEC/MEC nº 51/2018 e Guia
                de Referência Metodológica da PNP), não por câmpus — por isso a simulação abaixo afeta a instituição
                inteira, não um câmpus isolado.
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">Instituição</label>
                <select
                  value={instituicaoQeESelecionada}
                  onChange={(e) => setInstituicaoQeESelecionada(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione...</option>
                  {instituicoes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sigla} — {i.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">IEA</label>
                  <input
                    type="number"
                    step="any"
                    value={valorIeaPercentualQeE}
                    onChange={(e) => setValorIeaPercentualQeE(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">RAP</label>
                  <input
                    type="number"
                    step="any"
                    value={razaoDocenteAlunoQeE}
                    onChange={(e) => setRazaoDocenteAlunoQeE(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={adicionarAjusteInstituicao}
                disabled={!instituicaoQeESelecionada}
                className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                Adicionar ajuste
              </button>

              {erroAjusteInstituicao && (
                <p className="text-xs text-red-600 dark:text-red-400">{erroAjusteInstituicao}</p>
              )}

              {ajustesInstituicao.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {ajustesInstituicao.map((ajuste) => (
                    <li
                      key={ajuste.instituicaoId}
                      className="flex items-center justify-between gap-2 rounded-md bg-neutral-100 px-3 py-1.5 text-xs dark:bg-neutral-800"
                    >
                      <span>{resumirAjusteInstituicao(ajuste)}</span>
                      <button
                        type="button"
                        onClick={() => removerAjusteInstituicao(ajuste.instituicaoId)}
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
                      {execucao.orcamentoAssistenciaEstudantil ? (
                        <> · Assist. Estudantil: {formatoMoeda.format(execucao.orcamentoAssistenciaEstudantil)}</>
                      ) : null}
                      {execucao.percentualAnuidade ? <> · Anuidade CONIF: {execucao.percentualAnuidade}%</> : null}
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
    </div>
  );
}
