"use client";

import { Fragment, useState } from "react";
import { Variacao, calcularVariacao } from "@/components/shared/Variacao";
import type { CalculationRunDetail, InstituicaoResultado, UnidadeResultado } from "./TabelaDistribuicao";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoMoedaComSinal = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  signDisplay: "exceptZero",
});
const formatoPercentualComSinal = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const formatoNumeroComSinal = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export interface SimulacaoReitoriaInstituicao {
  reitoriaSimulada: number;
  deltaReitoria: number;
  pesoTotalMechda: number;
}

/**
 * Congela a Reitoria do Ano Atual no mesmo valor do Ano Anterior (por instituição, id estável) — o
 * excedente/déficit devolvido é redistribuído entre os câmpus dessa mesma instituição proporcionalmente
 * ao peso MECHDA de cada um no Ano Atual. Instituição sem par no Ano Anterior não entra no mapa (nada a
 * congelar). O total da instituição não muda (dinheiro só migra do bolso Reitoria para o bolso
 * Funcionamento) — só a repartição entre Reitoria/Funcionamento e entre câmpus é afetada.
 */
export function calcularSimulacaoReitoria(
  detalheAnterior: CalculationRunDetail,
  detalheAtual: CalculationRunDetail,
): Map<number, SimulacaoReitoriaInstituicao> {
  const anterioresPorId = new Map(detalheAnterior.instituicoes.map((i) => [i.id, i]));
  const mapa = new Map<number, SimulacaoReitoriaInstituicao>();
  for (const atual of detalheAtual.instituicoes) {
    const anterior = anterioresPorId.get(atual.id);
    if (!anterior) continue;
    const reitoriaSimulada = anterior.reitoriaValorReais;
    const deltaReitoria = atual.reitoriaValorReais - reitoriaSimulada;
    const pesoTotalMechda = atual.unidades.reduce(
      (acc, u) => acc + (u.detalheFuncionamento?.matriculaPonderadaCampus ?? 0),
      0,
    );
    mapa.set(atual.id, { reitoriaSimulada, deltaReitoria, pesoTotalMechda });
  }
  return mapa;
}

export function somarBlocosRede(detalhe: CalculationRunDetail, simulacao?: Map<number, SimulacaoReitoriaInstituicao>) {
  let funcionamento = 0;
  let reitoria = 0;
  let qualidadeEficiencia = 0;
  let assistenciaEstudantil = 0;
  for (const instituicao of detalhe.instituicoes) {
    const sim = simulacao?.get(instituicao.id);
    reitoria += sim ? sim.reitoriaSimulada : instituicao.reitoriaValorReais;
    qualidadeEficiencia += instituicao.qualidadeEficienciaValorReais;
    for (const unidade of instituicao.unidades) {
      const peso = unidade.detalheFuncionamento?.matriculaPonderadaCampus ?? 0;
      const parcela = sim && sim.pesoTotalMechda > 0 ? (peso / sim.pesoTotalMechda) * sim.deltaReitoria : 0;
      funcionamento += unidade.funcionamentoValorReais + parcela;
      assistenciaEstudantil += unidade.assistenciaEstudantilValorReais;
    }
  }
  return {
    funcionamento,
    reitoria,
    qualidadeEficiencia,
    assistenciaEstudantil,
    acao20RL: funcionamento + reitoria + qualidadeEficiencia,
    total: funcionamento + reitoria + qualidadeEficiencia + assistenciaEstudantil,
  };
}

function CelulaValor({ valor }: { valor: number }) {
  return <td className="py-2 pr-4 text-right">{formatoMoeda.format(valor)}</td>;
}

function CelulaValorOuTraco({ valor }: { valor: number | null }) {
  return valor !== null ? (
    <CelulaValor valor={valor} />
  ) : (
    <td className="py-2 pr-4 text-right text-neutral-400 dark:text-neutral-600">—</td>
  );
}

function CelulaVariacao({ anterior, atual }: { anterior: number | null; atual: number | null }) {
  if (anterior === null || atual === null) {
    const label = anterior === null ? "novo" : "saiu";
    const cor =
      anterior === null
        ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
        : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300";
    return (
      <>
        <td className="py-2 pr-4 text-right">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cor}`}>{label}</span>
        </td>
        <td className="py-2 pr-4 text-right" />
      </>
    );
  }
  const { delta, percentual } = calcularVariacao(anterior, atual);
  return (
    <>
      <td className="py-2 pr-4 text-right">
        <Variacao delta={delta}>{delta !== null ? formatoMoedaComSinal.format(delta) : ""}</Variacao>
      </td>
      <td className="py-2 pr-4 text-right">
        <Variacao delta={delta}>{percentual !== null ? formatoPercentualComSinal.format(percentual) : "novo"}</Variacao>
      </td>
    </>
  );
}

interface LinhaBloco {
  label: string;
  anterior: number;
  atual: number;
  destaque?: boolean;
  simulado?: boolean;
}

function TabelaResumoBlocos({
  anoAnterior,
  anoAtual,
  resumoAnterior,
  resumoAtual,
  congelarReitoria,
}: {
  anoAnterior: number;
  anoAtual: number;
  resumoAnterior: ReturnType<typeof somarBlocosRede>;
  resumoAtual: ReturnType<typeof somarBlocosRede>;
  congelarReitoria: boolean;
}) {
  const linhas: LinhaBloco[] = [
    {
      label: "Bloco Funcionamento (Matrículas/Campi)",
      anterior: resumoAnterior.funcionamento,
      atual: resumoAtual.funcionamento,
      simulado: congelarReitoria,
    },
    {
      label: "Bloco Reitorias",
      anterior: resumoAnterior.reitoria,
      atual: resumoAtual.reitoria,
      simulado: congelarReitoria,
    },
    {
      label: "Bloco Qualidade e Eficiência",
      anterior: resumoAnterior.qualidadeEficiencia,
      atual: resumoAtual.qualidadeEficiencia,
    },
    {
      label: "Total Ação 20RL (Funcionamento + Reitoria + Qualidade)",
      anterior: resumoAnterior.acao20RL,
      atual: resumoAtual.acao20RL,
      destaque: true,
    },
    {
      label: "Total Ação 2994 (Assistência Estudantil)",
      anterior: resumoAnterior.assistenciaEstudantil,
      atual: resumoAtual.assistenciaEstudantil,
      destaque: true,
    },
    { label: "Total Geral", anterior: resumoAnterior.total, atual: resumoAtual.total, destaque: true },
  ];

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <th className="py-2 pr-4">Bloco</th>
            <th className="py-2 pr-4 text-right">{anoAnterior}</th>
            <th className="py-2 pr-4 text-right">{anoAtual}</th>
            <th className="py-2 pr-4 text-right">Δ R$</th>
            <th className="py-2 pr-4 text-right">Δ %</th>
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
              <CelulaValor valor={linha.anterior} />
              <CelulaValor valor={linha.atual} />
              <CelulaVariacao anterior={linha.anterior} atual={linha.atual} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface CampusMesclado {
  id: number;
  nome: string;
  funcionamentoAnterior: number | null;
  funcionamentoAtual: number | null;
  assistenciaAnterior: number | null;
  assistenciaAtual: number | null;
  totalAnterior: number | null;
  totalAtual: number | null;
  mechdaAnterior: number | null;
  mechdaAtual: number | null;
}

export interface InstituicaoMesclada {
  id: number;
  sigla: string;
  nome: string;
  funcionamentoAnterior: number | null;
  funcionamentoAtual: number | null;
  assistenciaAnterior: number | null;
  assistenciaAtual: number | null;
  totalAnterior: number | null;
  totalAtual: number | null;
  reitoriaOficialAtual: number | null;
  reitoriaSimuladaAtual: number | null;
  campi: CampusMesclado[];
}

/**
 * Une as instituições/câmpus de dois runs por id (estável entre anos) — quem só aparece de um lado vira
 * "novo"/"saiu". Quando `simulacao` é passada (switch "Congelar Reitoria" ativo), a Reitoria e o
 * Funcionamento do Ano Atual são recalculados: Reitoria = mesma do Ano Anterior, e a diferença é
 * redistribuída entre os câmpus da instituição proporcionalmente ao peso MECHDA de cada um no Ano
 * Atual — o total da instituição não muda, só a repartição Reitoria/Funcionamento/câmpus.
 */
export function mesclarInstituicoes(
  anteriores: InstituicaoResultado[],
  atuais: InstituicaoResultado[],
  simulacao?: Map<number, SimulacaoReitoriaInstituicao>,
): InstituicaoMesclada[] {
  const porId = new Map<
    number,
    { sigla: string; nome: string; anterior?: InstituicaoResultado; atual?: InstituicaoResultado }
  >();

  for (const inst of anteriores) {
    porId.set(inst.id, { sigla: inst.sigla, nome: inst.nome, anterior: inst });
  }
  for (const inst of atuais) {
    const existente = porId.get(inst.id);
    if (existente) existente.atual = inst;
    else porId.set(inst.id, { sigla: inst.sigla, nome: inst.nome, atual: inst });
  }

  const resultado: InstituicaoMesclada[] = [];
  for (const [id, { sigla, nome, anterior, atual }] of porId) {
    const sim = atual ? simulacao?.get(id) : undefined;
    const reitoriaOficialAtual = atual ? atual.reitoriaValorReais : null;
    const reitoriaSimuladaAtual = sim ? sim.reitoriaSimulada : null;

    const campiPorId = new Map<number, { nome: string; anterior?: UnidadeResultado; atual?: UnidadeResultado }>();
    for (const u of anterior?.unidades ?? []) campiPorId.set(u.id, { nome: u.nome, anterior: u });
    for (const u of atual?.unidades ?? []) {
      const existente = campiPorId.get(u.id);
      if (existente) existente.atual = u;
      else campiPorId.set(u.id, { nome: u.nome, atual: u });
    }

    const campi: CampusMesclado[] = Array.from(campiPorId.entries())
      .map(([campusId, c]) => {
        const pesoCampus = c.atual?.detalheFuncionamento?.matriculaPonderadaCampus ?? 0;
        const parcelaReitoria =
          sim && sim.pesoTotalMechda > 0 && c.atual ? (pesoCampus / sim.pesoTotalMechda) * sim.deltaReitoria : 0;
        const funcionamentoAtual = c.atual ? c.atual.funcionamentoValorReais + parcelaReitoria : null;
        const assistenciaAtual = c.atual ? c.atual.assistenciaEstudantilValorReais : null;
        const totalAtual =
          funcionamentoAtual !== null && assistenciaAtual !== null ? funcionamentoAtual + assistenciaAtual : null;
        return {
          id: campusId,
          nome: c.nome,
          funcionamentoAnterior: c.anterior ? c.anterior.funcionamentoValorReais : null,
          funcionamentoAtual,
          assistenciaAnterior: c.anterior ? c.anterior.assistenciaEstudantilValorReais : null,
          assistenciaAtual,
          totalAnterior: c.anterior ? c.anterior.subtotalReais : null,
          totalAtual,
          mechdaAnterior: c.anterior?.detalheFuncionamento?.matriculaPonderadaCampus ?? null,
          mechdaAtual: c.atual?.detalheFuncionamento?.matriculaPonderadaCampus ?? null,
        };
      })
      .sort((x, y) => x.nome.localeCompare(y.nome));

    const assistenciaInstAnterior = anterior
      ? anterior.unidades.reduce((acc, u) => acc + u.assistenciaEstudantilValorReais, 0)
      : null;
    const assistenciaInstAtual = atual
      ? atual.unidades.reduce((acc, u) => acc + u.assistenciaEstudantilValorReais, 0)
      : null;
    const totalInstAnterior = anterior ? anterior.subtotalReais : null;
    const totalInstAtual = atual ? atual.subtotalReais : null;
    const funcionamentoInstAnterior =
      totalInstAnterior !== null && assistenciaInstAnterior !== null ? totalInstAnterior - assistenciaInstAnterior : null;
    const funcionamentoInstAtual =
      totalInstAtual !== null && assistenciaInstAtual !== null ? totalInstAtual - assistenciaInstAtual : null;

    resultado.push({
      id,
      sigla,
      nome,
      funcionamentoAnterior: funcionamentoInstAnterior,
      funcionamentoAtual: funcionamentoInstAtual,
      assistenciaAnterior: assistenciaInstAnterior,
      assistenciaAtual: assistenciaInstAtual,
      totalAnterior: totalInstAnterior,
      totalAtual: totalInstAtual,
      reitoriaOficialAtual,
      reitoriaSimuladaAtual,
      campi,
    });
  }

  return resultado.sort((a, b) => a.sigla.localeCompare(b.sigla));
}

function LinhaCampus({ campus }: { campus: CampusMesclado }) {
  const temMechda = campus.mechdaAnterior !== null && campus.mechdaAtual !== null;
  return (
    <tr className="border-b border-neutral-100 text-neutral-700 even:bg-neutral-50 dark:border-neutral-900 dark:text-neutral-300 dark:even:bg-neutral-900/40">
      <td className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 py-1.5 pr-4 pl-10 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col">
          <span>{campus.nome}</span>
          {temMechda && (
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              MECHDA: {formatoNumero.format(campus.mechdaAnterior as number)} →{" "}
              {formatoNumero.format(campus.mechdaAtual as number)} (
              {formatoNumeroComSinal.format((campus.mechdaAtual as number) - (campus.mechdaAnterior as number))})
            </span>
          )}
        </div>
      </td>
      <CelulaValorOuTraco valor={campus.funcionamentoAnterior} />
      <CelulaValorOuTraco valor={campus.funcionamentoAtual} />
      <CelulaVariacao anterior={campus.funcionamentoAnterior} atual={campus.funcionamentoAtual} />
      <CelulaValorOuTraco valor={campus.assistenciaAnterior} />
      <CelulaValorOuTraco valor={campus.assistenciaAtual} />
      <CelulaVariacao anterior={campus.assistenciaAnterior} atual={campus.assistenciaAtual} />
      <CelulaValorOuTraco valor={campus.totalAnterior} />
      <CelulaValorOuTraco valor={campus.totalAtual} />
      <CelulaVariacao anterior={campus.totalAnterior} atual={campus.totalAtual} />
    </tr>
  );
}

function ToggleCampiIcon({ expandido }: { expandido: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-neutral-400 text-[10px] leading-none text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
    >
      {expandido ? "−" : "+"}
    </span>
  );
}

export function TabelaComparativoInteranual({
  detalheAnterior,
  detalheAtual,
}: {
  detalheAnterior: CalculationRunDetail;
  detalheAtual: CalculationRunDetail;
}) {
  const [instituicoesExpandidas, setInstituicoesExpandidas] = useState<Set<number>>(new Set());
  const [congelarReitoria, setCongelarReitoria] = useState(false);

  function alternar(id: number) {
    const novo = new Set(instituicoesExpandidas);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setInstituicoesExpandidas(novo);
  }

  const anoAnterior = detalheAnterior.run.anoOrcamento ?? detalheAnterior.run.ano ?? 0;
  const anoAtual = detalheAtual.run.anoOrcamento ?? detalheAtual.run.ano ?? 0;

  const simulacaoReitoria = congelarReitoria ? calcularSimulacaoReitoria(detalheAnterior, detalheAtual) : undefined;

  const resumoAnterior = somarBlocosRede(detalheAnterior);
  const resumoAtual = somarBlocosRede(detalheAtual, simulacaoReitoria);

  const instituicoes = mesclarInstituicoes(detalheAnterior.instituicoes, detalheAtual.instituicoes, simulacaoReitoria);
  const instituicoesComCampi = instituicoes.filter((i) => i.campi.length > 0);
  const todasExpandidas =
    instituicoesComCampi.length > 0 && instituicoesComCampi.every((i) => instituicoesExpandidas.has(i.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Comparativo {anoAnterior} → {anoAtual}
          </h2>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={congelarReitoria}
              onChange={(e) => setCongelarReitoria(e.target.checked)}
            />
            Simular mesmo valor de Reitoria nos dois anos
          </label>
        </div>
        {congelarReitoria && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            A cota de Reitoria de cada instituição em {anoAtual} é fixada no mesmo valor de {anoAnterior}; a
            diferença é devolvida ao Bloco Funcionamento e redistribuída entre os câmpus da instituição
            proporcionalmente ao peso MECHDA de cada um em {anoAtual}. Isola a variação do custo administrativo da
            Reitoria, para avaliar se a variação da cota de um câmpus veio de desempenho relativo (MECHDA/
            indicadores) e não de uma Reitoria maior/menor.
          </p>
        )}
        <TabelaResumoBlocos
          anoAnterior={anoAnterior}
          anoAtual={anoAtual}
          resumoAnterior={resumoAnterior}
          resumoAtual={resumoAtual}
          congelarReitoria={congelarReitoria}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Por instituição / câmpus</h3>
          {instituicoesComCampi.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setInstituicoesExpandidas(
                  todasExpandidas ? new Set() : new Set(instituicoesComCampi.map((i) => i.id)),
                )
              }
              className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {todasExpandidas ? "Recolher todos os câmpus" : "Expandir todos os câmpus"}
            </button>
          )}
        </div>

        <div className="max-h-[75vh] overflow-auto rounded-md">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <th className="sticky top-0 left-0 z-30 border-r border-neutral-200 bg-neutral-50 py-2 pr-4 dark:border-neutral-800 dark:bg-neutral-950">
                  Instituição / Câmpus
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Funcionamento 20RL ({anoAnterior})
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Funcionamento 20RL ({anoAtual})
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ R$ Func.</th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ % Func.</th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Assist. 2994 ({anoAnterior})
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Assist. 2994 ({anoAtual})
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ R$ Assist.</th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ % Assist.</th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Total ({anoAnterior})
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  Total ({anoAtual})
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ R$ Total</th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ % Total</th>
              </tr>
            </thead>
            <tbody>
              {instituicoes.map((instituicao) => {
                const temCampi = instituicao.campi.length > 0;
                const expandida = temCampi && instituicoesExpandidas.has(instituicao.id);
                const reitoriaSimulada =
                  instituicao.reitoriaSimuladaAtual !== null &&
                  instituicao.reitoriaOficialAtual !== null &&
                  Math.abs(instituicao.reitoriaSimuladaAtual - instituicao.reitoriaOficialAtual) >= 0.005;
                return (
                  <Fragment key={`inst-comp-${instituicao.id}`}>
                    <tr className="group border-b border-neutral-100 font-medium text-neutral-900 even:bg-neutral-50 dark:border-neutral-900 dark:text-neutral-100 dark:even:bg-neutral-900/40">
                      <td className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 py-2 pr-4 dark:border-neutral-800 dark:bg-neutral-950">
                        <div className="flex items-center gap-2">
                          {temCampi ? (
                            <button
                              type="button"
                              onClick={() => alternar(instituicao.id)}
                              aria-label={
                                expandida
                                  ? `Recolher câmpus de ${instituicao.nome}`
                                  : `Expandir câmpus de ${instituicao.nome}`
                              }
                              className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              <ToggleCampiIcon expandido={expandida} />
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span>
                              {instituicao.sigla} — {instituicao.nome}
                            </span>
                            {reitoriaSimulada && (
                              <span className="w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                ⚡ Reitoria Simulada (Fixada em {formatoMoeda.format(instituicao.reitoriaSimuladaAtual as number)})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <CelulaValorOuTraco valor={instituicao.funcionamentoAnterior} />
                      <CelulaValorOuTraco valor={instituicao.funcionamentoAtual} />
                      <CelulaVariacao anterior={instituicao.funcionamentoAnterior} atual={instituicao.funcionamentoAtual} />
                      <CelulaValorOuTraco valor={instituicao.assistenciaAnterior} />
                      <CelulaValorOuTraco valor={instituicao.assistenciaAtual} />
                      <CelulaVariacao anterior={instituicao.assistenciaAnterior} atual={instituicao.assistenciaAtual} />
                      <CelulaValorOuTraco valor={instituicao.totalAnterior} />
                      <CelulaValorOuTraco valor={instituicao.totalAtual} />
                      <CelulaVariacao anterior={instituicao.totalAnterior} atual={instituicao.totalAtual} />
                    </tr>
                    {expandida &&
                      instituicao.campi.map((campus) => <LinhaCampus key={`campus-comp-${campus.id}`} campus={campus} />)}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-neutral-900 dark:text-neutral-100">
                <td className="pt-3 pr-4">Total geral</td>
                <CelulaValor valor={resumoAnterior.funcionamento} />
                <CelulaValor valor={resumoAtual.funcionamento} />
                <CelulaVariacao anterior={resumoAnterior.funcionamento} atual={resumoAtual.funcionamento} />
                <CelulaValor valor={resumoAnterior.assistenciaEstudantil} />
                <CelulaValor valor={resumoAtual.assistenciaEstudantil} />
                <CelulaVariacao anterior={resumoAnterior.assistenciaEstudantil} atual={resumoAtual.assistenciaEstudantil} />
                <CelulaValor valor={resumoAnterior.total} />
                <CelulaValor valor={resumoAtual.total} />
                <CelulaVariacao anterior={resumoAnterior.total} atual={resumoAtual.total} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
