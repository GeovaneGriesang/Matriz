"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { PROSE_LINK } from "@/lib/layoutWidths";
import { faixaRap, pesoRap, type FaixaRap } from "@/lib/qualidadeEficiencia";

export interface NoCampusSimulavel {
  unidadeId: number;
  nome: string;
  recebido: number;
  perda: number;
  estaNoPiso: boolean;
}

export interface RapInstituicao {
  rapPresencial: number;
  /** Soma do RAP ponderado recalculado de TODAS as outras instituições da rede (a
   * desta fica de fora, porque é o que muda ao simular). */
  restoRedeRapPonderado: number;
  rapEqualizadoOficial: number | null;
  vlRapOficial: number;
}

export interface NoInstituicaoSimulavel {
  sigla: string;
  nome: string;
  recebido: number;
  perda: number;
  /** `null` quando a instituição não tem indicador de RAP carregado neste ciclo. */
  rap: RapInstituicao | null;
  campi: NoCampusSimulavel[];
}

type Alvo =
  | { tipo: "rede" }
  | { tipo: "instituicao"; sigla: string }
  | { tipo: "campus"; unidadeId: number; siglaInstituicao: string };

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROTULO_FAIXA: Record<FaixaRap, string> = {
  MUITO_BAIXA: "muito baixa, abaixo de 18",
  BAIXA: "baixa, de 18 a 20",
  MEDIA: "média, de 20 a 22",
  MUITO_ALTA: "muito alta, 22 ou mais",
};

function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

/**
 * Simulador único: evasão e RAP deixaram de ser duas seções separadas (pedido do
 * usuário, "não quero trabalhar separadamente"). Uma árvore rede → instituição →
 * câmpus (mesmo esquema de "+/-" do Comparativo) escolhe o alvo, e os dois
 * controles mexem juntos no resultado desse alvo. RAP é sempre da instituição (não
 * existe RAP de câmpus isolado, ver /como-funciona#qualidade-eficiencia): ao
 * escolher um câmpus, o controle de RAP simula a instituição-mãe dele, deixado
 * claro no texto.
 */
export function SimuladorUnificado({
  noRede,
  instituicoes,
  totalBlocoRap,
}: {
  noRede: { recebido: number; perda: number; taxa: number };
  instituicoes: NoInstituicaoSimulavel[];
  totalBlocoRap: number;
}) {
  const [alvo, setAlvo] = useState<Alvo>({ tipo: "rede" });
  const [reducaoEvasao, setReducaoEvasao] = useState(50);
  const [rapSimulada, setRapSimulada] = useState(0);

  const instituicaoDoAlvo = useMemo(() => {
    if (alvo.tipo === "rede") return null;
    const sigla = alvo.tipo === "instituicao" ? alvo.sigla : alvo.siglaInstituicao;
    return instituicoes.find((i) => i.sigla === sigla) ?? null;
  }, [alvo, instituicoes]);

  const rapBase = instituicaoDoAlvo?.rap ?? null;

  useEffect(() => {
    setRapSimulada(rapBase?.rapPresencial ?? 0);
  }, [instituicaoDoAlvo?.sigla, rapBase?.rapPresencial]);

  const evasaoBase = useMemo(() => {
    if (alvo.tipo === "rede") {
      return { nome: "Rede inteira (todas as instituições)", recebido: noRede.recebido, perda: noRede.perda, estaNoPiso: false };
    }
    if (alvo.tipo === "instituicao") {
      const inst = instituicoes.find((i) => i.sigla === alvo.sigla);
      return inst ? { nome: `${inst.sigla}, toda a instituição`, recebido: inst.recebido, perda: inst.perda, estaNoPiso: false } : null;
    }
    const inst = instituicoes.find((i) => i.sigla === alvo.siglaInstituicao);
    const campus = inst?.campi.find((c) => c.unidadeId === alvo.unidadeId);
    return campus ? { nome: campus.nome, recebido: campus.recebido, perda: campus.perda, estaNoPiso: campus.estaNoPiso } : null;
  }, [alvo, noRede, instituicoes]);

  const resultado = useMemo(() => {
    if (!evasaoBase) return null;
    const fracao = reducaoEvasao / 100;
    const recuperadoEvasao = evasaoBase.perda * fracao;
    const novoRecebidoEvasao = evasaoBase.recebido + recuperadoEvasao;
    const novaPerdaEvasao = evasaoBase.perda - recuperadoEvasao;
    const taxaAtual = pct(evasaoBase.perda, evasaoBase.recebido);
    const novaTaxa = pct(novaPerdaEvasao, novoRecebidoEvasao);

    let rapCalc: {
      faixaAtual: FaixaRap; pesoAtual: number; faixaSimulada: FaixaRap; pesoSimulado: number;
      valorAtualRap: number; valorSimuladoRap: number; diferencaRap: number;
    } | null = null;

    if (rapBase && alvo.tipo !== "rede") {
      const faixaAtual = faixaRap(rapBase.rapPresencial);
      const pesoAtual = pesoRap(faixaAtual);
      const ponderadoAtual = rapBase.rapPresencial * pesoAtual;
      const faixaSimulada = faixaRap(rapSimulada);
      const pesoSimulado = pesoRap(faixaSimulada);
      const ponderadoSimulado = rapSimulada * pesoSimulado;
      const somaAtual = rapBase.restoRedeRapPonderado + ponderadoAtual;
      const somaSimulada = rapBase.restoRedeRapPonderado + ponderadoSimulado;
      const equalizadoAtual = somaAtual > 0 ? ponderadoAtual / somaAtual : 0;
      const equalizadoSimulado = somaSimulada > 0 ? ponderadoSimulado / somaSimulada : 0;
      const valorAtualRap = equalizadoAtual * totalBlocoRap;
      const valorSimuladoRap = equalizadoSimulado * totalBlocoRap;
      rapCalc = { faixaAtual, pesoAtual, faixaSimulada, pesoSimulado, valorAtualRap, valorSimuladoRap, diferencaRap: valorSimuladoRap - valorAtualRap };
    }

    return {
      recuperadoEvasao, novoRecebidoEvasao, novaPerdaEvasao, taxaAtual, novaTaxa,
      rapCalc, totalRecuperado: recuperadoEvasao + (rapCalc?.diferencaRap ?? 0),
    };
  }, [evasaoBase, reducaoEvasao, rapBase, rapSimulada, alvo.tipo, totalBlocoRap]);

  function alvoAtivo(candidato: Alvo): boolean {
    if (candidato.tipo === "rede") return alvo.tipo === "rede";
    if (candidato.tipo === "instituicao") return alvo.tipo === "instituicao" && alvo.sigla === candidato.sigla;
    return alvo.tipo === "campus" && alvo.unidadeId === candidato.unidadeId;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">1. Escolha o alvo</h2>
        <button
          type="button"
          onClick={() => setAlvo({ tipo: "rede" })}
          className={`w-fit rounded-md border px-3 py-1.5 text-left text-sm font-medium ${
            alvoAtivo({ tipo: "rede" })
              ? "border-if-green bg-if-green/10 text-if-green"
              : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          }`}
        >
          Rede inteira, todas as instituições
        </button>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <TabelaOrdenavel
            linhas={instituicoes}
            chaveLinha={(i) => i.sigla}
            linhaClasse={(i) =>
              (alvo.tipo === "instituicao" && alvo.sigla === i.sigla) ||
              (alvo.tipo === "campus" && alvo.siglaInstituicao === i.sigla)
                ? "bg-if-green/5"
                : ""
            }
            linhaExpandida={(i) =>
              i.campi.length === 0 ? null : (
                <ListaCampi campi={i.campi} siglaInstituicao={i.sigla} alvoAtivo={alvoAtivo} onSelecionar={setAlvo} />
              )
            }
            colunas={
              [
                {
                  chave: "instituicao",
                  rotulo: "Instituição",
                  valor: (i) => i.sigla,
                  render: (i) => (
                    <button
                      type="button"
                      onClick={() => setAlvo({ tipo: "instituicao", sigla: i.sigla })}
                      className="text-left hover:underline"
                    >
                      <span className="font-medium">{i.sigla}</span>
                      <span className="ml-2 text-xs text-neutral-500">{i.nome}</span>
                    </button>
                  ),
                },
                {
                  chave: "perda",
                  rotulo: "Perda por evasão",
                  alinhamento: "right",
                  valor: (i) => i.perda,
                  render: (i) => <span className="text-neutral-600 dark:text-neutral-400">{i.perda > 0 ? reais.format(i.perda) : "—"}</span>,
                },
                {
                  chave: "rap",
                  rotulo: "RAP Presencial",
                  alinhamento: "right",
                  valor: (i) => i.rap?.rapPresencial ?? null,
                  render: (i) => <span className="text-neutral-600 dark:text-neutral-400">{i.rap ? decimal.format(i.rap.rapPresencial) : "—"}</span>,
                },
              ] satisfies ColunaOrdenavel<NoInstituicaoSimulavel>[]
            }
          />
        </div>
      </div>

      {evasaoBase && resultado && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            2. Simule, {evasaoBase.nome}
          </h2>

          {alvo.tipo === "campus" && (
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              RAP é sempre indicador de instituição, nunca de um câmpus isolado (ver{" "}
              <Link href="/como-funciona#qualidade-eficiencia" className={PROSE_LINK}>
                Qualidade e Eficiência
              </Link>
              ): o controle abaixo simula a RAP de <strong>{alvo.siglaInstituicao}</strong>, a
              instituição deste câmpus, não deste câmpus sozinho.
            </p>
          )}
          {alvo.tipo !== "rede" && !rapBase && (
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              Esta instituição não tem indicador de RAP carregado neste ciclo; a simulação abaixo
              considera só a evasão.
            </p>
          )}
          {alvo.tipo === "rede" && (
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              RAP se simula por instituição. Escolha uma acima (ou um câmpus dela) para incluir RAP
              nesta simulação; na rede inteira, só a evasão se aplica.
            </p>
          )}
          {evasaoBase.estaNoPiso && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <strong>{evasaoBase.nome}</strong> já está travado no Piso Mínimo (R$ 700.000), não no
              valor calculado pela matrícula. Reduzir a evasão simulada aqui pode não mudar nada o que
              este câmpus recebe de verdade.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-col gap-1 text-sm">
              <span className="flex items-baseline justify-between font-medium text-neutral-900 dark:text-neutral-100">
                <span>Redução simulada da evasão</span>
                <span className="tabular-nums text-if-green">{reducaoEvasao}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={reducaoEvasao}
                onChange={(e) => setReducaoEvasao(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-if-green dark:bg-neutral-800"
                aria-label="Percentual de redução da evasão simulada"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>0%, sem mudança</span>
                <span>100%, evasão zerada</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <span className="flex items-baseline justify-between font-medium text-neutral-900 dark:text-neutral-100">
                <span>RAP Presencial simulada</span>
                <span className="tabular-nums text-if-green">{rapBase ? decimal.format(rapSimulada) : "—"}</span>
              </span>
              <input
                type="range"
                min={10}
                max={30}
                step={0.1}
                value={rapSimulada}
                disabled={!rapBase}
                onChange={(e) => setRapSimulada(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-if-green disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-800"
                aria-label="RAP Presencial simulada"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>10, poucos alunos por professor</span>
                <span>30, muitos alunos por professor</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao rotulo="Recebido hoje (evasão)" valor={reais.format(evasaoBase.recebido)} />
            <Cartao rotulo="Recuperado, evasão" valor={reais.format(resultado.recuperadoEvasao)} destaque="text-if-green" />
            <Cartao
              rotulo="Diferença, RAP"
              valor={resultado.rapCalc ? `${resultado.rapCalc.diferencaRap >= 0 ? "+" : ""}${reais.format(resultado.rapCalc.diferencaRap)}` : "não se aplica"}
              destaque={resultado.rapCalc ? (resultado.rapCalc.diferencaRap >= 0 ? "text-if-green" : "text-if-red dark:text-red-400") : undefined}
            />
            <Cartao
              rotulo="Total recuperado, combinado"
              valor={`${resultado.totalRecuperado >= 0 ? "+" : ""}${reais.format(resultado.totalRecuperado)}`}
              destaque={resultado.totalRecuperado >= 0 ? "text-if-green" : "text-if-red dark:text-red-400"}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-neutral-600 dark:text-neutral-400"></th>
                  <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Recebido (evasão)</th>
                  <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Taxa de perda</th>
                  <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">RAP</th>
                  <th className="px-4 py-2.5 text-right font-medium text-neutral-600 dark:text-neutral-400">Faixa RAP</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">Hoje</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(evasaoBase.recebido)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{decimal.format(resultado.taxaAtual)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rapBase ? decimal.format(rapBase.rapPresencial) : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{resultado.rapCalc ? ROTULO_FAIXA[resultado.rapCalc.faixaAtual] : "—"}</td>
                </tr>
                <tr className="border-t border-neutral-200 bg-if-green/5 font-medium dark:border-neutral-800">
                  <td className="px-4 py-2.5">No cenário simulado</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-if-green">{reais.format(resultado.novoRecebidoEvasao)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{decimal.format(resultado.novaTaxa)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{rapBase ? decimal.format(rapSimulada) : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-xs">{resultado.rapCalc ? ROTULO_FAIXA[resultado.rapCalc.faixaSimulada] : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ListaCampi({
  campi,
  siglaInstituicao,
  alvoAtivo,
  onSelecionar,
}: {
  campi: NoCampusSimulavel[];
  siglaInstituicao: string;
  alvoAtivo: (candidato: Alvo) => boolean;
  onSelecionar: (alvo: Alvo) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-3 py-2 font-medium">Câmpus</th>
            <th className="px-3 py-2 text-right font-medium">Recebido</th>
            <th className="px-3 py-2 text-right font-medium">Perda</th>
          </tr>
        </thead>
        <tbody>
          {campi.map((c) => {
            const candidato: Alvo = { tipo: "campus", unidadeId: c.unidadeId, siglaInstituicao };
            const ativo = alvoAtivo(candidato);
            return (
              <tr key={c.unidadeId} className={`border-t border-neutral-200 dark:border-neutral-800 ${ativo ? "bg-if-green/5" : ""}`}>
                <td className="px-3 py-1.5">
                  <button type="button" onClick={() => onSelecionar(candidato)} className="text-left hover:underline">
                    {c.nome}
                    {c.estaNoPiso && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">no piso</span>}
                  </button>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(c.recebido)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(c.perda)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${destaque ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {valor}
      </div>
    </div>
  );
}
