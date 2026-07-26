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

function somarBlocosRede(detalhe: CalculationRunDetail) {
  let funcionamento = 0;
  let reitoria = 0;
  let qualidadeEficiencia = 0;
  let assistenciaEstudantil = 0;
  for (const instituicao of detalhe.instituicoes) {
    reitoria += instituicao.reitoriaValorReais;
    qualidadeEficiencia += instituicao.qualidadeEficienciaValorReais;
    for (const unidade of instituicao.unidades) {
      funcionamento += unidade.funcionamentoValorReais;
      assistenciaEstudantil += unidade.assistenciaEstudantilValorReais;
    }
  }
  return { funcionamento, reitoria, qualidadeEficiencia, assistenciaEstudantil, total: detalhe.totalGeralReais };
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
}

function TabelaResumoBlocos({
  anoAnterior,
  anoAtual,
  resumoAnterior,
  resumoAtual,
}: {
  anoAnterior: number;
  anoAtual: number;
  resumoAnterior: ReturnType<typeof somarBlocosRede>;
  resumoAtual: ReturnType<typeof somarBlocosRede>;
}) {
  const linhas: LinhaBloco[] = [
    {
      label: "Bloco Funcionamento (Matrículas/Campi)",
      anterior: resumoAnterior.funcionamento,
      atual: resumoAtual.funcionamento,
    },
    { label: "Bloco Reitorias", anterior: resumoAnterior.reitoria, atual: resumoAtual.reitoria },
    {
      label: "Bloco Qualidade e Eficiência",
      anterior: resumoAnterior.qualidadeEficiencia,
      atual: resumoAtual.qualidadeEficiencia,
    },
    {
      label: "Bloco Assistência Estudantil",
      anterior: resumoAnterior.assistenciaEstudantil,
      atual: resumoAtual.assistenciaEstudantil,
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
              <td className="py-2 pr-4">{linha.label}</td>
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

interface CampusMesclado {
  id: number;
  nome: string;
  totalAnterior: number | null;
  totalAtual: number | null;
  mechdaAnterior: number | null;
  mechdaAtual: number | null;
}

interface InstituicaoMesclada {
  id: number;
  sigla: string;
  nome: string;
  totalAnterior: number | null;
  totalAtual: number | null;
  campi: CampusMesclado[];
}

/** Une as instituições/câmpus de dois runs por id (estável entre anos) — quem só aparece de um lado vira "novo"/"saiu". */
function mesclarInstituicoes(
  anteriores: InstituicaoResultado[],
  atuais: InstituicaoResultado[],
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
    const campiPorId = new Map<number, { nome: string; anterior?: UnidadeResultado; atual?: UnidadeResultado }>();
    for (const u of anterior?.unidades ?? []) campiPorId.set(u.id, { nome: u.nome, anterior: u });
    for (const u of atual?.unidades ?? []) {
      const existente = campiPorId.get(u.id);
      if (existente) existente.atual = u;
      else campiPorId.set(u.id, { nome: u.nome, atual: u });
    }

    const campi: CampusMesclado[] = Array.from(campiPorId.entries())
      .map(([campusId, c]) => ({
        id: campusId,
        nome: c.nome,
        totalAnterior: c.anterior ? c.anterior.subtotalReais : null,
        totalAtual: c.atual ? c.atual.subtotalReais : null,
        mechdaAnterior: c.anterior?.detalheFuncionamento?.matriculaPonderadaCampus ?? null,
        mechdaAtual: c.atual?.detalheFuncionamento?.matriculaPonderadaCampus ?? null,
      }))
      .sort((x, y) => x.nome.localeCompare(y.nome));

    resultado.push({
      id,
      sigla,
      nome,
      totalAnterior: anterior ? anterior.subtotalReais : null,
      totalAtual: atual ? atual.subtotalReais : null,
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

  function alternar(id: number) {
    const novo = new Set(instituicoesExpandidas);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setInstituicoesExpandidas(novo);
  }

  const anoAnterior = detalheAnterior.run.anoOrcamento ?? detalheAnterior.run.ano ?? 0;
  const anoAtual = detalheAtual.run.anoOrcamento ?? detalheAtual.run.ano ?? 0;

  const resumoAnterior = somarBlocosRede(detalheAnterior);
  const resumoAtual = somarBlocosRede(detalheAtual);

  const instituicoes = mesclarInstituicoes(detalheAnterior.instituicoes, detalheAtual.instituicoes);
  const instituicoesComCampi = instituicoes.filter((i) => i.campi.length > 0);
  const todasExpandidas =
    instituicoesComCampi.length > 0 && instituicoesComCampi.every((i) => instituicoesExpandidas.has(i.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Comparativo {anoAnterior} → {anoAtual}
        </h2>
        <TabelaResumoBlocos
          anoAnterior={anoAnterior}
          anoAtual={anoAtual}
          resumoAnterior={resumoAnterior}
          resumoAtual={resumoAtual}
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
                  {anoAnterior}
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                  {anoAtual}
                </th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ R$</th>
                <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Δ %</th>
              </tr>
            </thead>
            <tbody>
              {instituicoes.map((instituicao) => {
                const temCampi = instituicao.campi.length > 0;
                const expandida = temCampi && instituicoesExpandidas.has(instituicao.id);
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
                          <span>
                            {instituicao.sigla} — {instituicao.nome}
                          </span>
                        </div>
                      </td>
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
