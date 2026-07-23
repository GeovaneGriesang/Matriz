"use client";

import { Fragment, useState } from "react";

interface DetalheFuncionamento {
  matriculaPonderadaCampus: number;
  totalMatriculaPonderadaRede: number;
  share: number;
  pesoBloco: number;
  valorBlocoRede: number;
  valorReais: number;
}

interface DetalheIea {
  valorIea: number | null;
  band: string;
  peso: number;
  ponderado: number;
  somaPonderadosRede: number;
  share: number;
  pesoSubBloco: number;
  valorSubBlocoRede: number;
  valorReais: number;
}

interface DetalheRap {
  razaoDocenteAluno: number;
  band: string;
  peso: number;
  ponderado: number;
  somaPonderadosRede: number;
  share: number;
  pesoSubBloco: number;
  valorSubBlocoRede: number;
  valorReais: number;
}

interface DetalheIaplCategoria {
  matriculasCampus: number;
  totalMatriculasRede: number;
  share: number;
  valorCategoriaRede: number;
  valorReais: number;
}

interface DetalheIapl {
  tecnicos: DetalheIaplCategoria;
  formacaoProfessores: DetalheIaplCategoria;
  proeja: DetalheIaplCategoria;
  pesoSubBloco: number;
  valorSubBlocoRede: number;
  valorTotal: number;
}

interface DetalheQualidadeEficiencia {
  iea: DetalheIea | null;
  rap: DetalheRap | null;
  iapl: DetalheIapl | null;
  valorTotal: number;
}

interface DetalheReitoria {
  numeroInstituicoes: number;
  pesoBloco: number;
  valorBlocoRede: number;
  valorReais: number;
}

export interface UnidadeResultado {
  id: number;
  nome: string;
  funcionamentoValorReais: number;
  qualidadeEficienciaValorReais: number;
  subtotalReais: number;
  detalheFuncionamento: DetalheFuncionamento | null;
  detalheQualidadeEficiencia: DetalheQualidadeEficiencia | null;
}

export interface InstituicaoResultado {
  id: number;
  sigla: string;
  nome: string;
  reitoriaValorReais: number;
  unidades: UnidadeResultado[];
  subtotalReais: number;
  detalheReitoria: DetalheReitoria | null;
}

export interface CalculationRunDetail {
  run: {
    id: number;
    status: string;
    ano: number | null;
    anoOrcamento: number | null;
    orcamentoTotal: number | null;
    startedAt: string;
    finishedAt: string | null;
    errorMessage: string | null;
  };
  instituicoes: InstituicaoResultado[];
  totalGeralReais: number;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoPercentual = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2 });
const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

const NOME_FAIXA: Record<string, string> = {
  MUITO_BAIXO: "muito baixa",
  BAIXO: "baixa",
  MEDIO: "média",
  ALTO: "alta",
  MUITO_ALTO: "muito alta",
  MUITO_BAIXA: "muito baixa",
  BAIXA: "baixa",
  MEDIA: "média",
  ALTA: "alta",
  MUITO_ALTA: "muito alta",
};

function ItemMemoria({ children }: { children: React.ReactNode }) {
  return <li className="text-neutral-700 dark:text-neutral-300">{children}</li>;
}

function MemoriaFuncionamento({ detalhe }: { detalhe: DetalheFuncionamento }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        Matrícula Ponderada do câmpus: <strong>{formatoNumero.format(detalhe.matriculaPonderadaCampus)}</strong> ÷
        total da rede <strong>{formatoNumero.format(detalhe.totalMatriculaPonderadaRede)}</strong> = participação{" "}
        <strong>{formatoPercentual.format(detalhe.share)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Bloco Funcionamento: {formatoPercentual.format(detalhe.pesoBloco)} × orçamento total ={" "}
        {formatoMoeda.format(detalhe.valorBlocoRede)}
      </ItemMemoria>
      <ItemMemoria>
        Valor do câmpus: {formatoPercentual.format(detalhe.share)} × {formatoMoeda.format(detalhe.valorBlocoRede)} ={" "}
        <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
    </ul>
  );
}

function MemoriaIea({ detalhe }: { detalhe: DetalheIea }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        IEA do câmpus: {detalhe.valorIea !== null ? formatoPercentual.format(detalhe.valorIea) : "—"} → faixa{" "}
        <strong>{NOME_FAIXA[detalhe.band] ?? detalhe.band}</strong> (peso {formatoNumero.format(detalhe.peso)})
      </ItemMemoria>
      <ItemMemoria>
        IEA Ponderado = IEA × peso = {detalhe.valorIea !== null ? formatoPercentual.format(detalhe.valorIea) : "—"} ×{" "}
        {formatoNumero.format(detalhe.peso)} = <strong>{formatoNumero.format(detalhe.ponderado)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        IEA Equalizado = ponderado do câmpus {formatoNumero.format(detalhe.ponderado)} ÷ soma de ponderados da rede{" "}
        {formatoNumero.format(detalhe.somaPonderadosRede)} = participação{" "}
        <strong>{formatoPercentual.format(detalhe.share)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Sub-bloco IEA: {formatoPercentual.format(detalhe.pesoSubBloco)} × orçamento total ={" "}
        {formatoMoeda.format(detalhe.valorSubBlocoRede)}
      </ItemMemoria>
      <ItemMemoria>
        Valor do câmpus: {formatoPercentual.format(detalhe.share)} × {formatoMoeda.format(detalhe.valorSubBlocoRede)}{" "}
        = <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
    </ul>
  );
}

function MemoriaRap({ detalhe }: { detalhe: DetalheRap }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        Razão docente/aluno do câmpus: <strong>{formatoNumero.format(detalhe.razaoDocenteAluno)}</strong> → faixa{" "}
        <strong>{NOME_FAIXA[detalhe.band] ?? detalhe.band}</strong> (peso {formatoNumero.format(detalhe.peso)})
      </ItemMemoria>
      <ItemMemoria>
        RAP Ponderado = RAP × peso = {formatoNumero.format(detalhe.razaoDocenteAluno)} ×{" "}
        {formatoNumero.format(detalhe.peso)} = <strong>{formatoNumero.format(detalhe.ponderado)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        RAP Equalizado = ponderado do câmpus {formatoNumero.format(detalhe.ponderado)} ÷ soma de ponderados da rede{" "}
        {formatoNumero.format(detalhe.somaPonderadosRede)} = participação{" "}
        <strong>{formatoPercentual.format(detalhe.share)}</strong>
      </ItemMemoria>
      <ItemMemoria>
        Sub-bloco RAP: {formatoPercentual.format(detalhe.pesoSubBloco)} × orçamento total ={" "}
        {formatoMoeda.format(detalhe.valorSubBlocoRede)}
      </ItemMemoria>
      <ItemMemoria>
        Valor do câmpus: {formatoPercentual.format(detalhe.share)} × {formatoMoeda.format(detalhe.valorSubBlocoRede)}{" "}
        = <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
      </ItemMemoria>
    </ul>
  );
}

function MemoriaIaplCategoria({ nome, detalhe }: { nome: string; detalhe: DetalheIaplCategoria }) {
  return (
    <ItemMemoria>
      <strong>{nome}</strong>: matrículas do câmpus {formatoNumero.format(detalhe.matriculasCampus)} ÷ total da rede{" "}
      {formatoNumero.format(detalhe.totalMatriculasRede)} = {formatoPercentual.format(detalhe.share)} ×{" "}
      {formatoMoeda.format(detalhe.valorCategoriaRede)} ={" "}
      <strong>{formatoMoeda.format(detalhe.valorReais)}</strong>
    </ItemMemoria>
  );
}

function MemoriaIapl({ detalhe }: { detalhe: DetalheIapl }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        Sub-bloco IAPL: {formatoPercentual.format(detalhe.pesoSubBloco)} × orçamento total ={" "}
        {formatoMoeda.format(detalhe.valorSubBlocoRede)}, dividido nas 3 metas legais (Técnicos 70% / Formação de
        Professores 20% / Proeja 10%)
      </ItemMemoria>
      <MemoriaIaplCategoria nome="Técnicos" detalhe={detalhe.tecnicos} />
      <MemoriaIaplCategoria nome="Formação de Professores" detalhe={detalhe.formacaoProfessores} />
      <MemoriaIaplCategoria nome="Proeja" detalhe={detalhe.proeja} />
    </ul>
  );
}

function MemoriaQualidadeEficiencia({ detalhe }: { detalhe: DetalheQualidadeEficiencia }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium text-neutral-900 dark:text-neutral-100">IEA</p>
        {detalhe.iea ? <MemoriaIea detalhe={detalhe.iea} /> : <p className="text-neutral-500">Sem dado de IEA para este câmpus.</p>}
      </div>
      <div>
        <p className="font-medium text-neutral-900 dark:text-neutral-100">RAP</p>
        {detalhe.rap ? <MemoriaRap detalhe={detalhe.rap} /> : <p className="text-neutral-500">Sem dado de RAP para este câmpus.</p>}
      </div>
      <div>
        <p className="font-medium text-neutral-900 dark:text-neutral-100">IAPL</p>
        {detalhe.iapl ? <MemoriaIapl detalhe={detalhe.iapl} /> : <p className="text-neutral-500">Sem dado de IAPL para este câmpus.</p>}
      </div>
    </div>
  );
}

function MemoriaReitoria({ detalhe }: { detalhe: DetalheReitoria }) {
  const valorPorInstituicao = detalhe.numeroInstituicoes === 0 ? 0 : detalhe.valorBlocoRede / detalhe.numeroInstituicoes;
  return (
    <ul className="list-disc space-y-1 pl-5">
      <ItemMemoria>
        Bloco Reitorias: {formatoPercentual.format(detalhe.pesoBloco)} × orçamento total ={" "}
        {formatoMoeda.format(detalhe.valorBlocoRede)}
      </ItemMemoria>
      <ItemMemoria>
        Dividido igualmente entre {detalhe.numeroInstituicoes} instituições:{" "}
        {formatoMoeda.format(detalhe.valorBlocoRede)} ÷ {detalhe.numeroInstituicoes} ={" "}
        <strong>{formatoMoeda.format(valorPorInstituicao)}</strong>
      </ItemMemoria>
    </ul>
  );
}

function BotaoMemoria({ aberto, onClick }: { aberto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
    >
      {aberto ? "Ocultar memória de cálculo" : "Ver memória de cálculo"}
    </button>
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

export function TabelaDistribuicao({ detalhe }: { detalhe: CalculationRunDetail }) {
  const [instituicoesAbertas, setInstituicoesAbertas] = useState<Set<number>>(new Set());
  const [unidadesAbertas, setUnidadesAbertas] = useState<Set<number>>(new Set());
  const [instituicoesExpandidas, setInstituicoesExpandidas] = useState<Set<number>>(new Set());

  function alternar(conjunto: Set<number>, setConjunto: (s: Set<number>) => void, id: number) {
    const novo = new Set(conjunto);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setConjunto(novo);
  }

  const instituicoesComCampi = detalhe.instituicoes.filter((i) => i.unidades.length > 0);
  const todasExpandidas =
    instituicoesComCampi.length > 0 && instituicoesComCampi.every((i) => instituicoesExpandidas.has(i.id));

  function alternarTodasInstituicoes() {
    setInstituicoesExpandidas(todasExpandidas ? new Set() : new Set(instituicoesComCampi.map((i) => i.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {detalhe.run.anoOrcamento !== null
            ? `Execução #${detalhe.run.id} — orçamento oficial ${detalhe.run.anoOrcamento}`
            : `Execução #${detalhe.run.id} — ano ${detalhe.run.ano ?? "?"}`}
        </h2>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          Orçamento: {detalhe.run.orcamentoTotal !== null ? formatoMoeda.format(detalhe.run.orcamentoTotal) : "—"}
        </span>
      </div>
      <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        {detalhe.run.anoOrcamento !== null
          ? `Calculado com base nos dados da PNP de ${detalhe.run.ano ?? "?"} (referência oficial: dois anos antes do orçamento).`
          : `Simulação executada com os dados da PNP de ${detalhe.run.ano ?? "?"}.`}
      </p>

      {instituicoesComCampi.length > 0 && (
        <button
          type="button"
          onClick={alternarTodasInstituicoes}
          className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {todasExpandidas ? "Recolher todos os câmpus" : "Expandir todos os câmpus"}
        </button>
      )}

      <div className="max-h-[75vh] overflow-auto rounded-md">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <th className="sticky top-0 left-0 z-30 border-r border-neutral-200 bg-neutral-50 py-2 pr-4 dark:border-neutral-800 dark:bg-neutral-950">
                Instituição / Câmpus
              </th>
              <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                Total distribuído
              </th>
              <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">Reitoria</th>
              <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                Funcionamento
              </th>
              <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 text-right dark:bg-neutral-950">
                Qualidade e Eficiência
              </th>
              <th className="sticky top-0 z-20 bg-neutral-50 py-2 pr-4 dark:bg-neutral-950" />
            </tr>
          </thead>
          <tbody>
            {detalhe.instituicoes.map((instituicao) => {
              const instituicaoAberta = instituicoesAbertas.has(instituicao.id);
              const temCampi = instituicao.unidades.length > 0;
              const campiVisiveis = temCampi && instituicoesExpandidas.has(instituicao.id);
              return (
                <Fragment key={`instituicao-frag-${instituicao.id}`}>
                  <tr className="group border-b border-neutral-100 font-medium text-neutral-900 even:bg-neutral-50 dark:border-neutral-900 dark:text-neutral-100 dark:even:bg-neutral-900/40">
                    <td className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 py-2 pr-4 group-even:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:group-even:bg-neutral-900">
                      <div className="flex items-center gap-2">
                        {temCampi ? (
                          <button
                            type="button"
                            onClick={() => alternar(instituicoesExpandidas, setInstituicoesExpandidas, instituicao.id)}
                            aria-label={
                              campiVisiveis
                                ? `Recolher câmpus de ${instituicao.nome}`
                                : `Expandir câmpus de ${instituicao.nome}`
                            }
                            className="hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <ToggleCampiIcon expandido={campiVisiveis} />
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span>
                          {instituicao.sigla} — {instituicao.nome}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right">{formatoMoeda.format(instituicao.subtotalReais)}</td>
                    <td className="py-2 pr-4 text-right">{formatoMoeda.format(instituicao.reitoriaValorReais)}</td>
                    <td className="py-2 pr-4 text-right">—</td>
                    <td className="py-2 pr-4 text-right">—</td>
                    <td className="py-2 pr-4 text-right">
                      {instituicao.detalheReitoria && (
                        <BotaoMemoria
                          aberto={instituicaoAberta}
                          onClick={() => alternar(instituicoesAbertas, setInstituicoesAbertas, instituicao.id)}
                        />
                      )}
                    </td>
                  </tr>
                  {instituicaoAberta && instituicao.detalheReitoria && (
                    <tr className="border-b border-neutral-100 bg-neutral-100 dark:border-neutral-900 dark:bg-neutral-900">
                      <td colSpan={6} className="px-4 py-3">
                        <MemoriaReitoria detalhe={instituicao.detalheReitoria} />
                      </td>
                    </tr>
                  )}
                  {campiVisiveis &&
                    instituicao.unidades.map((unidade) => {
                      const unidadeAberta = unidadesAbertas.has(unidade.id);
                      return (
                        <Fragment key={`unidade-frag-${unidade.id}`}>
                          <tr className="group border-b border-neutral-100 text-neutral-700 even:bg-neutral-50 dark:border-neutral-900 dark:text-neutral-300 dark:even:bg-neutral-900/40">
                            <td className="sticky left-0 z-10 border-r border-neutral-200 bg-neutral-50 py-1.5 pr-4 pl-10 group-even:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:group-even:bg-neutral-900">
                              {unidade.nome}
                            </td>
                            <td className="py-1.5 pr-4 text-right">{formatoMoeda.format(unidade.subtotalReais)}</td>
                            <td className="py-1.5 pr-4 text-right">—</td>
                            <td className="py-1.5 pr-4 text-right">
                              {formatoMoeda.format(unidade.funcionamentoValorReais)}
                            </td>
                            <td className="py-1.5 pr-4 text-right">
                              {formatoMoeda.format(unidade.qualidadeEficienciaValorReais)}
                            </td>
                            <td className="py-1.5 pr-4 text-right">
                              {(unidade.detalheFuncionamento || unidade.detalheQualidadeEficiencia) && (
                                <BotaoMemoria
                                  aberto={unidadeAberta}
                                  onClick={() => alternar(unidadesAbertas, setUnidadesAbertas, unidade.id)}
                                />
                              )}
                            </td>
                          </tr>
                          {unidadeAberta && (
                            <tr className="border-b border-neutral-100 bg-neutral-100 dark:border-neutral-900 dark:bg-neutral-900">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="flex flex-col gap-4">
                                  {unidade.detalheFuncionamento && (
                                    <div>
                                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                        Bloco Funcionamento
                                      </p>
                                      <MemoriaFuncionamento detalhe={unidade.detalheFuncionamento} />
                                    </div>
                                  )}
                                  {unidade.detalheQualidadeEficiencia && (
                                    <div>
                                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                                        Bloco Qualidade e Eficiência
                                      </p>
                                      <MemoriaQualidadeEficiencia detalhe={unidade.detalheQualidadeEficiencia} />
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-neutral-900 dark:text-neutral-100">
              <td className="pt-3 pr-4">Total geral</td>
              <td className="pt-3 pr-4 text-right">{formatoMoeda.format(detalhe.totalGeralReais)}</td>
              <td className="pt-3 pr-4" />
              <td className="pt-3 pr-4" />
              <td className="pt-3 pr-4" />
              <td className="pt-3 pr-4" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
