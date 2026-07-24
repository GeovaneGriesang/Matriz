"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { salvarOrcamentoAnualAction, calcularDistribuicaoOficialAction } from "@/server/actions/orcamentoAnual";

type Escopo = "CONIF" | "TODAS";

interface OrcamentoAnual {
  ano: number;
  valorTotal: number;
  valorAssistenciaEstudantil: number;
  percentualAnuidade: number;
  updatedAt: string;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function formatarTempo(segundos: number): string {
  const min = Math.floor(segundos / 60)
    .toString()
    .padStart(2, "0");
  const seg = (segundos % 60).toString().padStart(2, "0");
  return `${min}:${seg}`;
}

export function OrcamentoAnualPanel() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoAnual[]>([]);
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [valorTotal, setValorTotal] = useState(0);
  const [valorAssistenciaEstudantil, setValorAssistenciaEstudantil] = useState(0);
  const [percentualAnuidade, setPercentualAnuidade] = useState("0");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [escopoPorAno, setEscopoPorAno] = useState<Record<number, Escopo>>({});
  const [calculandoAno, setCalculandoAno] = useState<number | null>(null);
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);
  const [mensagemPorAno, setMensagemPorAno] = useState<Record<number, string>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
  }, []);

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
      setValorAssistenciaEstudantil(0);
      setPercentualAnuidade("0");
      carregarOrcamentos();
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function handleCalcular(anoAlvo: number) {
    const escopo = escopoPorAno[anoAlvo] ?? "CONIF";
    setCalculandoAno(anoAlvo);
    setMensagemPorAno((atual) => ({ ...atual, [anoAlvo]: "" }));
    setSegundosDecorridos(0);
    timerRef.current = setInterval(() => setSegundosDecorridos((s) => s + 1), 1000);

    try {
      const formData = new FormData();
      formData.set("ano", String(anoAlvo));
      formData.set("escopo", escopo);
      const resultado = await calcularDistribuicaoOficialAction(formData);
      if (!resultado.ok) {
        throw new Error(resultado.errorMessage ?? "Não foi possível calcular a distribuição oficial.");
      }
      setMensagemPorAno((atual) => ({
        ...atual,
        [anoAlvo]: `Calculado — execução #${resultado.runId}, ${resultado.instituicoesIncluidas} instituições incluídas.`,
      }));
    } catch (error) {
      setMensagemPorAno((atual) => ({ ...atual, [anoAlvo]: (error as Error).message }));
    } finally {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCalculandoAno(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
        <p className="font-medium">Como funciona a distribuição:</p>
        <p>
          Os dois valores informados abaixo são o orçamento total de <strong>todo o escopo</strong> selecionado —
          eles não são copiados para cada instituição. O Custeio e Funcionamento (Ação 20RL) é separado
          automaticamente em 80% para o Bloco Funcionamento, 10% para o Bloco Reitorias e 10% para o Bloco
          Qualidade e Eficiência. Os Blocos Funcionamento e Qualidade e Eficiência são divididos
          proporcionalmente entre <strong>todos os câmpus de todas as instituições do escopo</strong>, de acordo
          com os indicadores da PNP de cada um — câmpus maiores ou com melhores indicadores recebem uma fatia
          maior, não um valor fixo por instituição. O Bloco Reitorias usa essa mesma base (Matrícula Ponderada),
          só que agregada por instituição — uma instituição maior recebe uma fatia maior dos 10%, não uma
          divisão igual entre as instituições.
        </p>
        <p className="mt-2">
          A Assistência Estudantil (Ação 2994 / PNAES) é isolada do Custeio 20RL — não é deduzida dele. É rateada
          primeiro entre as instituições do escopo, proporcionalmente à RF Ponderada de cada uma (soma do
          percentual de matrículas em cada faixa de Renda Familiar Per Capita × peso da faixa — peso 2,5 para a
          faixa de menor renda até 0 para RFP&gt;3,5 ou não declarada, escala oficial da Matriz de Distribuição
          Orçamentária da Rede Federal). Como a PNP só fornece a faixa de RFP por instituição (não por câmpus), o
          valor de cada instituição é então subdividido entre seus câmpus proporcionalmente à Matrícula Ponderada
          (mesma base do Bloco Funcionamento).
        </p>
        <p className="mt-2">
          <strong>CONIF</strong>: 38 Institutos Federais + CEFET-MG + CEFET-RJ + Colégio Pedro II (41
          instituições). <strong>Todas as instituições federais</strong>: CONIF + 23 escolas técnicas
          vinculadas a universidades federais (64 instituições).
        </p>
      </div>

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
            Orçamento Total de Custeio e Funcionamento (Ação 20RL) [R$]
          </label>
          <CurrencyInput
            id="valorTotal"
            name="valorTotal"
            value={valorTotal}
            onChange={setValorTotal}
            disabled={salvando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Valor global destinado ao Custeio e Funcionamento (Ação 20RL da LOA). A partir deste montante, o
            sistema separa automaticamente 10% para Reitorias, 10% para Indicadores de Qualidade/Eficiência (IEA,
            RAP e IAPL calculados via CSV) e 80% para Funcionamento dos Câmpus. A Ação 2994 (Assistência
            Estudantil) é calculada de forma independente.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="valorAssistenciaEstudantil"
            className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            Orçamento de Assistência Estudantil (Ação 2994 / PNAES) [R$]
          </label>
          <CurrencyInput
            id="valorAssistenciaEstudantil"
            name="valorAssistenciaEstudantil"
            value={valorAssistenciaEstudantil}
            onChange={setValorAssistenciaEstudantil}
            disabled={salvando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Valor exato da Ação 2994 (PNAES na LOA). Isolado do custeio geral e distribuído entre a instituição e
            seus câmpis, apurado com base nas faixas de Renda Familiar Per Capita (RFP) declaradas pelos
            estudantes (dados da Plataforma Nilo Peçanha).
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="percentualAnuidade" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Percentual de Anuidade CONIF [%]
          </label>
          <input
            id="percentualAnuidade"
            name="percentualAnuidade"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={percentualAnuidade}
            onChange={(e) => setPercentualAnuidade(e.target.value)}
            disabled={salvando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Percentual único para toda a rede, calculado sobre o Custeio (20RL) já distribuído de cada instituição
            (Funcionamento + Reitorias + Qualidade e Eficiência). Valor informativo — não é deduzido do que a
            instituição recebe, só exibido como referência do que ela deve repassar ao CONIF. Deixe em 0% para não
            calcular anuidade.
          </p>
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
            {orcamentos.map((o) => {
              const escopoAtual = escopoPorAno[o.ano] ?? "CONIF";
              const calculandoEsteAno = calculandoAno === o.ano;
              return (
                <li
                  key={o.ano}
                  className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {o.ano} — Custeio (20RL): {formatoMoeda.format(o.valorTotal)} · Assist. Estudantil (2994):{" "}
                      {formatoMoeda.format(o.valorAssistenciaEstudantil)}
                      {o.percentualAnuidade ? <> · Anuidade CONIF: {o.percentualAnuidade}%</> : null}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      Atualizado em {formatoData.format(new Date(o.updatedAt))}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Referência PNP: dados de {o.ano - 2}
                  </p>

                  <div className="flex flex-wrap items-center gap-4">
                    <fieldset className="flex items-center gap-3 text-xs">
                      <legend className="sr-only">Escopo de {o.ano}</legend>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`escopo-${o.ano}`}
                          checked={escopoAtual === "CONIF"}
                          onChange={() => setEscopoPorAno((atual) => ({ ...atual, [o.ano]: "CONIF" }))}
                          disabled={calculandoAno !== null}
                        />
                        CONIF (41 instituições)
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`escopo-${o.ano}`}
                          checked={escopoAtual === "TODAS"}
                          onChange={() => setEscopoPorAno((atual) => ({ ...atual, [o.ano]: "TODAS" }))}
                          disabled={calculandoAno !== null}
                        />
                        Todas as instituições federais (64)
                      </label>
                    </fieldset>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleCalcular(o.ano)}
                      disabled={calculandoAno !== null}
                      className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    >
                      {calculandoEsteAno ? `Calculando... ${formatarTempo(segundosDecorridos)}` : "Calcular distribuição oficial"}
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
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
