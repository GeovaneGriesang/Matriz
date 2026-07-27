"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { Variacao, calcularVariacao } from "@/components/shared/Variacao";
import { salvarOrcamentoAnualAction, calcularDistribuicaoOficialAction } from "@/server/actions/orcamentoAnual";
import {
  PESO_BLOCO_FUNCIONAMENTO,
  PESO_BLOCO_REITORIAS,
  PESO_BLOCO_QUALIDADE_EFICIENCIA,
} from "@/calculation-engine/constants/blocos.constants";
import { ESTRATEGIA_FAIXAS_IEA_INFO } from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import type { EstrategiaFaixasIea } from "@/calculation-engine/types/qualidadeEficiencia.types";

type Escopo = "CONIF" | "TODAS";

export interface OrcamentoAnual {
  ano: number;
  valorTotal: number;
  ajuste: number;
  valorAssistenciaEstudantil: number;
  percentualAnuidade: number;
  pisoMinimoCampusNovo: number;
  estrategiaFaixasIea: EstrategiaFaixasIea;
  updatedAt: string;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoMoedaComSinal = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  signDisplay: "exceptZero",
});
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const formatoPercentual = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 });
const formatoPercentualComSinal = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/**
 * Blocos calculados no nível da rede a partir de um `OrcamentoAnual` — usado na memória de cálculo
 * e no comparativo. Funcionamento/Reitorias/Qualidade e Eficiência (80/10/10) são divididos sobre
 * `valorTotal - ajuste` (base real), nunca sobre o Custeio Bruto puro — mesma regra de
 * `runCalculation.ts` (ver `baseCalculoPercentuais`), validada no Prompt 10 batendo o RAP oficial a
 * 0% para as 41 instituições CONIF em 2026.
 */
export function calcularBlocosRede(o: OrcamentoAnual) {
  const baseCalculoPercentuais = o.valorTotal - o.ajuste;
  const bloco1Matriculas = PESO_BLOCO_FUNCIONAMENTO * baseCalculoPercentuais;
  const bloco1Reitoria = PESO_BLOCO_REITORIAS * baseCalculoPercentuais;
  const bloco1Subtotal = bloco1Matriculas + bloco1Reitoria;
  const bloco2 = PESO_BLOCO_QUALIDADE_EFICIENCIA * baseCalculoPercentuais;
  const bloco3 = o.valorAssistenciaEstudantil;
  const acao20RL = bloco1Subtotal + bloco2;
  const totalGeral = acao20RL + bloco3;
  return { baseCalculoPercentuais, bloco1Matriculas, bloco1Reitoria, bloco1Subtotal, bloco2, bloco3, acao20RL, totalGeral };
}

/**
 * Simula a Reitoria do Ano Atual fixada no mesmo valor (em reais) do Ano Anterior — a diferença é
 * devolvida ao Bloco Matrículas/Campi. Sem granularidade de câmpus neste painel (só totais de rede),
 * então não há redistribuição por MECHDA aqui — essa parte fica no comparativo por câmpus do /consulta.
 * O total geral não muda (dinheiro só migra de bolso).
 */
export function simularCongelamentoReitoria(anoAnterior: OrcamentoAnual, anoAtual: OrcamentoAnual) {
  const a = calcularBlocosRede(anoAnterior);
  const bOficial = calcularBlocosRede(anoAtual);
  const reitoriaSimulada = a.bloco1Reitoria;
  const deltaReitoria = bOficial.bloco1Reitoria - reitoriaSimulada;
  const bloco1Matriculas = bOficial.bloco1Matriculas + deltaReitoria;
  return { ...bOficial, bloco1Reitoria: reitoriaSimulada, bloco1Matriculas };
}

type TipoOrigem = "digitado" | "totalizador" | "calculo" | "normativo";

const ORIGEM_ESTILO: Record<TipoOrigem, string> = {
  digitado: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  totalizador: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  calculo: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  normativo: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300",
};

const ORIGEM_LABEL: Record<TipoOrigem, string> = {
  digitado: "Digitado",
  totalizador: "Totalizador",
  calculo: "Cálculo",
  normativo: "Normativo",
};

function TagOrigem({ tipo }: { tipo: TipoOrigem }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ORIGEM_ESTILO[tipo]}`}>
      {ORIGEM_LABEL[tipo]}
    </span>
  );
}

function LinhaMemoria({
  label,
  formula,
  valor,
  tipo,
  destaque,
}: {
  label: string;
  formula?: string;
  valor: string;
  tipo: TipoOrigem;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
      <div className="flex items-center gap-2">
        <TagOrigem tipo={tipo} />
        <span className={destaque ? "font-medium text-neutral-900 dark:text-neutral-100" : "text-neutral-700 dark:text-neutral-300"}>
          {label}
        </span>
        {formula && <span className="text-xs text-neutral-500 dark:text-neutral-400">({formula})</span>}
      </div>
      <span className={destaque ? "font-mono font-semibold text-neutral-900 dark:text-neutral-100" : "font-mono text-neutral-700 dark:text-neutral-300"}>
        {valor}
      </span>
    </div>
  );
}

/**
 * Tabela oficial de pesos da Matrícula Equalizada por Carga Horária e Dias Ativos (MECHDA),
 * metodologia da PNP citada na Portaria/livro de referência — exibida aqui como parâmetro
 * normativo fixo (não recalculado por este sistema). A "Matrícula / Campi" acima já entra no
 * cálculo com o valor de "Matrícula Equivalente" que a própria PNP publica por câmpus/curso —
 * já com esses pesos aplicados na origem. Ver o detalhamento Bruta → Equivalente por câmpus,
 * com os números reais ingeridos, em /consulta.
 */
function NotaMechda() {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <TagOrigem tipo="normativo" />
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          MECHDA — pesos oficiais aplicados pela PNP na origem
        </span>
      </div>
      <p className="text-neutral-500 dark:text-neutral-400">
        A "Matrícula Equivalente" usada acima já vem calculada pela Plataforma Nilo Peçanha com a
        metodologia oficial abaixo — este sistema consome o valor final por câmpus/curso e não
        reaplica esses pesos, para não contá-los em dobro.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-left">
          <thead>
            <tr className="text-neutral-500 dark:text-neutral-400">
              <th className="py-1 pr-4">Critério</th>
              <th className="py-1 pr-4">Faixa</th>
              <th className="py-1">Peso oficial</th>
            </tr>
          </thead>
          <tbody className="text-neutral-700 dark:text-neutral-300">
            <tr>
              <td className="py-1 pr-4">Modalidade</td>
              <td className="py-1 pr-4">Presencial</td>
              <td className="py-1 font-mono">1,00</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Modalidade</td>
              <td className="py-1 pr-4">EaD — Recurso Próprio</td>
              <td className="py-1 font-mono">0,80</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Modalidade</td>
              <td className="py-1 pr-4">EaD — Fomento Externo (UAB / Novos Caminhos)</td>
              <td className="py-1 font-mono">0,25</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Laboratórios (CNCT/CST)</td>
              <td className="py-1 pr-4">1 laboratório</td>
              <td className="py-1 font-mono">1,00</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Laboratórios (CNCT/CST)</td>
              <td className="py-1 pr-4">2 laboratórios</td>
              <td className="py-1 font-mono">1,50</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Laboratórios (CNCT/CST)</td>
              <td className="py-1 pr-4">3 laboratórios</td>
              <td className="py-1 font-mono">2,00</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Laboratórios (CNCT/CST)</td>
              <td className="py-1 pr-4">4 ou mais laboratórios</td>
              <td className="py-1 font-mono">2,50</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Técnico Integrado</td>
              <td className="py-1 pr-4">Piso mínimo, independe dos laboratórios</td>
              <td className="py-1 font-mono">1,50</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Área/Eixo Agrícola-Pecuária</td>
              <td className="py-1 pr-4">Bonificação</td>
              <td className="py-1 font-mono">+50%</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Pós-Graduação Stricto Sensu</td>
              <td className="py-1 pr-4">Peso base 2,50 + bônus 50%</td>
              <td className="py-1 font-mono">3,75</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Retenção</td>
              <td className="py-1 pr-4">Até 1.095 dias (3 anos)</td>
              <td className="py-1 font-mono">parcial/proporcional</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Retenção</td>
              <td className="py-1 pr-4">Acima de 1.095 dias</td>
              <td className="py-1 font-mono">0,00 (excluído)</td>
            </tr>
            <tr>
              <td className="py-1 pr-4">Carga Horária</td>
              <td className="py-1 pr-4">Teto</td>
              <td className="py-1 font-mono">limitada ao CNCT</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Memória de cálculo do topo da árvore (rede inteira, a partir dos valores digitados no
 * orçamento do ano) — mostra como a Ação 20RL Bruta se reparte em Bloco 1 (Funcionamento
 * 80% + Reitoria 10% = 90%) e Bloco 2 (Qualidade e Eficiência 10%), isola o Bloco 3
 * (Assistência Estudantil, Ação 2994) do rateio do 20RL, e evidencia que a Anuidade CONIF é
 * só informativa (não abate a base de rateio). Não depende de nenhuma execução de cálculo —
 * é aritmética pura sobre o `OrcamentoAnual` já salvo, disponível assim que o ano é salvo.
 */
function MemoriaCalculoGeracao({ o }: { o: OrcamentoAnual }) {
  const totalGeral = o.valorTotal + o.valorAssistenciaEstudantil;
  const anuidadeValor = (o.percentualAnuidade / 100) * o.valorTotal;
  const totalMenosAnuidade = o.valorTotal - anuidadeValor;
  const { baseCalculoPercentuais, bloco1Matriculas, bloco1Reitoria, bloco1Subtotal, bloco2 } = calcularBlocosRede(o);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-2 dark:border-neutral-800">
        <span className="font-medium text-neutral-900 dark:text-neutral-100">Legenda:</span>
        <TagOrigem tipo="digitado" />
        <span className="text-neutral-500 dark:text-neutral-400">informado manualmente</span>
        <TagOrigem tipo="totalizador" />
        <span className="text-neutral-500 dark:text-neutral-400">totalizadores</span>
        <TagOrigem tipo="calculo" />
        <span className="text-neutral-500 dark:text-neutral-400">cálculos / fórmulas</span>
        <TagOrigem tipo="normativo" />
        <span className="text-neutral-500 dark:text-neutral-400">parâmetro fixo do livro/Portaria</span>
      </div>

      <div className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        <LinhaMemoria label="Ação 20RL (Custeio Bruto)" valor={formatoMoeda.format(o.valorTotal)} tipo="digitado" destaque />
        <LinhaMemoria
          label="Ajuste (deduzido antes do rateio 80/10/10)"
          valor={formatoMoeda.format(o.ajuste)}
          tipo="digitado"
        />
        <LinhaMemoria
          label="Base de cálculo do rateio 80/10/10"
          formula="20RL Bruto − Ajuste"
          valor={formatoMoeda.format(baseCalculoPercentuais)}
          tipo="calculo"
          destaque
        />
        <LinhaMemoria
          label="Ação 2994 (Assistência Estudantil)"
          valor={formatoMoeda.format(o.valorAssistenciaEstudantil)}
          tipo="digitado"
          destaque
        />
        <LinhaMemoria
          label="Total Geral"
          formula="20RL + 2994"
          valor={formatoMoeda.format(totalGeral)}
          tipo="totalizador"
          destaque
        />
        <LinhaMemoria
          label={`Anuidade CONIF (${formatoPercentual.format(o.percentualAnuidade / 100)})`}
          formula="% sobre o 20RL Bruto"
          valor={formatoMoeda.format(anuidadeValor)}
          tipo="calculo"
        />
        <LinhaMemoria
          label="20RL − Anuidade"
          formula="exibição informativa — não realimenta nenhum cálculo abaixo"
          valor={formatoMoeda.format(totalMenosAnuidade)}
          tipo="calculo"
        />
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">
          Bloco 1 — Funcionamento (90% da Base de cálculo)
        </p>
        <LinhaMemoria label="Matrículas / Campi" formula="80% × Base de cálculo" valor={formatoMoeda.format(bloco1Matriculas)} tipo="calculo" />
        <LinhaMemoria label="Reitoria" formula="10% × Base de cálculo" valor={formatoMoeda.format(bloco1Reitoria)} tipo="calculo" />
        <LinhaMemoria label="Subtotal Bloco 1" valor={formatoMoeda.format(bloco1Subtotal)} tipo="totalizador" destaque />
        <NotaMechda />
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">
          Bloco 2 — Qualidade e Eficiência (10% da Base de cálculo)
        </p>
        <LinhaMemoria label="IEA + RAP + IAPL" formula="10% × Base de cálculo" valor={formatoMoeda.format(bloco2)} tipo="calculo" destaque />
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="font-medium text-neutral-900 dark:text-neutral-100">
          Bloco 3 — Assistência Estudantil (isolado do 20RL)
        </p>
        <LinhaMemoria
          label="Ação 2994 (100%)"
          valor={formatoMoeda.format(o.valorAssistenciaEstudantil)}
          tipo="calculo"
          destaque
        />
      </div>

      <p className="text-neutral-500 dark:text-neutral-400">
        Esta é a árvore no nível da rede, a partir dos valores digitados neste ano — o rateio por instituição/câmpus
        (Matrícula Ponderada, IEA/RAP/IAPL, RFP) só existe depois de{" "}
        <span className="font-medium">Calcular distribuição oficial</span>; veja essa trilha detalhada em{" "}
        <Link href="/consulta" className="underline hover:text-neutral-900 dark:hover:text-neutral-100">
          /consulta
        </Link>
        .
      </p>
    </div>
  );
}

function CelulaVariacaoRede({ anterior, atual }: { anterior: number; atual: number }) {
  const { delta, percentual } = calcularVariacao(anterior, atual);
  return (
    <>
      <td className="py-2 pr-4 text-right font-mono">
        <Variacao delta={delta}>{delta !== null ? formatoMoedaComSinal.format(delta) : ""}</Variacao>
      </td>
      <td className="py-2 text-right font-mono">
        <Variacao delta={delta}>{percentual !== null ? formatoPercentualComSinal.format(percentual) : "novo"}</Variacao>
      </td>
    </>
  );
}

/**
 * Comparativo interanual no nível da rede — mesma aritmética pura de `MemoriaCalculoGeracao`, mas
 * lado a lado para dois anos já salvos. Não depende de nenhuma execução de cálculo. Quando
 * `congelarReitoria` está ativo, o Ano Atual usa `simularCongelamentoReitoria` (Reitoria fixada no
 * valor do Ano Anterior, diferença devolvida ao Bloco Matrículas/Campi).
 */
function ComparativoOrcamentoAnual({
  anoAnterior,
  anoAtual,
  congelarReitoria,
}: {
  anoAnterior: OrcamentoAnual;
  anoAtual: OrcamentoAnual;
  congelarReitoria: boolean;
}) {
  const a = calcularBlocosRede(anoAnterior);
  const b = congelarReitoria ? simularCongelamentoReitoria(anoAnterior, anoAtual) : calcularBlocosRede(anoAtual);
  const linhas: { label: string; a: number; b: number; destaque?: boolean; simulado?: boolean }[] = [
    { label: "Bloco 1 — Matrículas/Campi (80%)", a: a.bloco1Matriculas, b: b.bloco1Matriculas, simulado: congelarReitoria },
    { label: "Bloco 1 — Reitoria (10%)", a: a.bloco1Reitoria, b: b.bloco1Reitoria, simulado: congelarReitoria },
    { label: "Subtotal Bloco 1 (90%)", a: a.bloco1Subtotal, b: b.bloco1Subtotal, destaque: true },
    { label: "Bloco 2 — Qualidade e Eficiência (10%)", a: a.bloco2, b: b.bloco2 },
    { label: "Total Ação 20RL (Bloco 1 + Bloco 2)", a: a.acao20RL, b: b.acao20RL, destaque: true },
    { label: "Total Ação 2994 (Assistência Estudantil)", a: a.bloco3, b: b.bloco3, destaque: true },
    { label: "Total Geral", a: a.totalGeral, b: b.totalGeral, destaque: true },
  ];

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <th className="py-2 pr-4">Item</th>
            <th className="py-2 pr-4 text-right">{anoAnterior.ano}</th>
            <th className="py-2 pr-4 text-right">{anoAtual.ano}</th>
            <th className="py-2 pr-4 text-right">Δ R$</th>
            <th className="py-2 text-right">Δ %</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={linha.label}
              className={`border-b border-neutral-100 dark:border-neutral-900 ${
                linha.destaque ? "font-semibold text-neutral-900 dark:text-neutral-100" : "text-neutral-700 dark:text-neutral-300"
              }`}
            >
              <td className="py-2 pr-4">
                {linha.label}
                {linha.simulado && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    ⚡ simulado
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 text-right font-mono">{formatoMoeda.format(linha.a)}</td>
              <td className="py-2 pr-4 text-right font-mono">{formatoMoeda.format(linha.b)}</td>
              <CelulaVariacaoRede anterior={linha.a} atual={linha.b} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const [ajuste, setAjuste] = useState(0);
  const [valorAssistenciaEstudantil, setValorAssistenciaEstudantil] = useState(0);
  const [percentualAnuidade, setPercentualAnuidade] = useState("0.15");
  const [pisoMinimoCampusNovo, setPisoMinimoCampusNovo] = useState(0);
  const [estrategiaFaixasIea, setEstrategiaFaixasIea] = useState<EstrategiaFaixasIea>("PLANILHA_2026");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [escopoPorAno, setEscopoPorAno] = useState<Record<number, Escopo>>({});
  const [calculandoAno, setCalculandoAno] = useState<number | null>(null);
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);
  const [mensagemPorAno, setMensagemPorAno] = useState<Record<number, string>>({});
  const [memoriaAbertaPorAno, setMemoriaAbertaPorAno] = useState<Record<number, boolean>>({});
  const [compararAtivo, setCompararAtivo] = useState(false);
  const [anoComparacaoAnterior, setAnoComparacaoAnterior] = useState<number | null>(null);
  const [anoComparacaoAtual, setAnoComparacaoAtual] = useState<number | null>(null);
  const [congelarReitoria, setCongelarReitoria] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (compararAtivo && orcamentos.length >= 2 && anoComparacaoAnterior === null && anoComparacaoAtual === null) {
      setAnoComparacaoAtual(orcamentos[0]?.ano ?? null);
      setAnoComparacaoAnterior(orcamentos[1]?.ano ?? null);
    }
  }, [compararAtivo, orcamentos, anoComparacaoAnterior, anoComparacaoAtual]);

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
      setAjuste(0);
      setValorAssistenciaEstudantil(0);
      setPercentualAnuidade("0.15");
      setPisoMinimoCampusNovo(0);
      setEstrategiaFaixasIea("PLANILHA_2026");
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
          <label htmlFor="ajuste" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Ajuste [R$]
          </label>
          <CurrencyInput
            id="ajuste"
            name="ajuste"
            value={ajuste}
            onChange={setAjuste}
            disabled={salvando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Dedução aplicada sobre o Custeio Bruto acima ANTES de separar em 80/10/10 (Funcionamento/Reitorias/
            Qualidade e Eficiência) — corresponde ao "Ajuste" da planilha-modelo CONIF, já resolvido contra os
            valores reais deste sistema (não copie o valor bruto da planilha sem recalcular contra a Assistência
            Estudantil informada acima — os dois usam bases diferentes). Deixe em R$ 0,00 para não aplicar
            nenhum ajuste.
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
            instituição recebe, só exibido como referência do que ela deve repassar ao CONIF. Alíquota oficial
            CONIF: 0,15% (já pré-preenchido) — ajuste aqui se o CONIF alterar a taxa em anos futuros. Deixe em 0%
            para não calcular anuidade.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="pisoMinimoCampusNovo"
            className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            Piso Mínimo do Bloco Funcionamento para Câmpus Novo [R$]
          </label>
          <CurrencyInput
            id="pisoMinimoCampusNovo"
            name="pisoMinimoCampusNovo"
            value={pisoMinimoCampusNovo}
            onChange={setPisoMinimoCampusNovo}
            disabled={salvando}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Valor mínimo garantido do Bloco Funcionamento para câmpus criados a partir de 2018 (cadastrados em{" "}
            <Link href="/admin/unidades" className="underline hover:text-neutral-900 dark:hover:text-neutral-100">
              Câmpus
            </Link>
            ), já com o IPCA do ano aplicado (calcule fora do sistema — ele não estima IPCA). Regra oficial CONIF:
            R$ 700.000 corrigidos, se o cálculo proporcional do câmpus ficar abaixo disso. Deixe em R$ 0,00 para
            não aplicar nenhum piso.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Faixas de peso do IEA
          </legend>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Duas fontes oficiais documentam faixas/pesos de IEA diferentes — o sistema mantém as duas disponíveis,
            nenhuma é descartada. Esta escolha só decide qual tabela enquadra o IEA no cálculo oficial deste ano.
          </p>
          <div className="flex flex-col gap-2">
            {(Object.keys(ESTRATEGIA_FAIXAS_IEA_INFO) as EstrategiaFaixasIea[]).map((chave) => (
              <label key={chave} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="estrategiaFaixasIea"
                  value={chave}
                  checked={estrategiaFaixasIea === chave}
                  onChange={() => setEstrategiaFaixasIea(chave)}
                  disabled={salvando}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {ESTRATEGIA_FAIXAS_IEA_INFO[chave].label}
                  </span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                    {ESTRATEGIA_FAIXAS_IEA_INFO[chave].descricao}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
                      {o.ano} — Custeio (20RL): {formatoMoeda.format(o.valorTotal)}
                      {o.ajuste ? <> · Ajuste: −{formatoMoeda.format(o.ajuste)}</> : null} · Assist. Estudantil
                      (2994): {formatoMoeda.format(o.valorAssistenciaEstudantil)}
                      {o.percentualAnuidade ? <> · Anuidade CONIF: {o.percentualAnuidade}%</> : null}
                      {o.pisoMinimoCampusNovo ? (
                        <> · Piso Câmpus Novo: {formatoMoeda.format(o.pisoMinimoCampusNovo)}</>
                      ) : null}
                      {" · Faixas IEA: "}
                      {ESTRATEGIA_FAIXAS_IEA_INFO[o.estrategiaFaixasIea].label}
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
                    <button
                      type="button"
                      onClick={() =>
                        setMemoriaAbertaPorAno((atual) => ({ ...atual, [o.ano]: !atual[o.ano] }))
                      }
                      className="text-xs font-medium text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    >
                      {memoriaAbertaPorAno[o.ano] ? "Ocultar memória de cálculo" : "Ver memória de cálculo"}
                    </button>
                  </div>

                  {memoriaAbertaPorAno[o.ano] && <MemoriaCalculoGeracao o={o} />}

                  {mensagemPorAno[o.ano] && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">{mensagemPorAno[o.ano]}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Comparativo interanual</h2>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={compararAtivo}
              onChange={(e) => setCompararAtivo(e.target.checked)}
            />
            Comparar com outro ano
          </label>
        </div>

        {compararAtivo &&
          (orcamentos.length < 2 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              É preciso pelo menos dois anos cadastrados para comparar.
            </p>
          ) : (
            <>
              <label className="flex w-fit items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={congelarReitoria}
                  onChange={(e) => setCongelarReitoria(e.target.checked)}
                />
                Congelar valor da Reitoria (equalizar Reitoria A e B)
              </label>
              {congelarReitoria && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  A Reitoria do Ano de Referência é fixada no mesmo valor do Ano de Comparação; a diferença é
                  devolvida ao Bloco Matrículas/Campi. Isola a variação do custo administrativo da Reitoria — a
                  redistribuição por câmpus/MECHDA aparece no comparativo detalhado do /consulta.
                </p>
              )}

              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="anoComparacaoAnterior"
                    className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
                  >
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
                    {orcamentos.map((o) => (
                      <option key={o.ano} value={o.ano}>
                        {o.ano}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="anoComparacaoAtual"
                    className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
                  >
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
                    {orcamentos.map((o) => (
                      <option key={o.ano} value={o.ano}>
                        {o.ano}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {anoComparacaoAnterior !== null &&
                anoComparacaoAtual !== null &&
                (anoComparacaoAnterior === anoComparacaoAtual ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">Selecione dois anos diferentes.</p>
                ) : (
                  (() => {
                    const oAnterior = orcamentos.find((o) => o.ano === anoComparacaoAnterior);
                    const oAtual = orcamentos.find((o) => o.ano === anoComparacaoAtual);
                    if (!oAnterior || !oAtual) return null;
                    return (
                      <ComparativoOrcamentoAnual
                        anoAnterior={oAnterior}
                        anoAtual={oAtual}
                        congelarReitoria={congelarReitoria}
                      />
                    );
                  })()
                ))}
            </>
          ))}
      </div>
    </div>
  );
}
