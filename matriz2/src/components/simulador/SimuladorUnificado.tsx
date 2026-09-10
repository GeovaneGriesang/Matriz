"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { PROSE_LINK } from "@/lib/layoutWidths";
import {
  faixaRap,
  pesoRap,
  pesoIaplTecnicos,
  pesoIaplFormacaoProfessores,
  pesoIaplProeja,
  type FaixaRap,
} from "@/lib/qualidadeEficiencia";

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
}

export interface IaplInstituicao {
  aplTecnico: number;
  restoRedeTecnico: number;
  aplFormacaoProfessor: number;
  restoRedeFormacao: number;
  aplProeja: number;
  restoRedeProeja: number;
}

export interface NoInstituicaoSimulavel {
  sigla: string;
  nome: string;
  recebido: number;
  perda: number;
  /** `null` quando a instituição não tem indicador de RAP/IAPL carregado neste ciclo. */
  rap: RapInstituicao | null;
  iapl: IaplInstituicao | null;
  campi: NoCampusSimulavel[];
}

interface ValoresIapl {
  tecnico: number;
  formacao: number;
  proeja: number;
}

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

function sinal(v: number): string {
  return v >= 0 ? "+" : "";
}

function corSinal(v: number): string {
  return v >= 0 ? "text-if-green" : "text-if-red dark:text-red-400";
}

/** Diferença em reais que simular uma nova RAP causaria no bloco RAP desta instituição. */
function diferencaRap(rap: RapInstituicao, rapSimulada: number, totalBlocoRap: number): number {
  const pesoAtual = pesoRap(faixaRap(rap.rapPresencial));
  const ponderadoAtual = rap.rapPresencial * pesoAtual;
  const pesoSimulado = pesoRap(faixaRap(rapSimulada));
  const ponderadoSimulado = rapSimulada * pesoSimulado;
  const somaAtual = rap.restoRedeRapPonderado + ponderadoAtual;
  const somaSimulada = rap.restoRedeRapPonderado + ponderadoSimulado;
  const equalizadoAtual = somaAtual > 0 ? ponderadoAtual / somaAtual : 0;
  const equalizadoSimulado = somaSimulada > 0 ? ponderadoSimulado / somaSimulada : 0;
  return (equalizadoSimulado - equalizadoAtual) * totalBlocoRap;
}

/** Mesma ideia da RAP, mas com as três categorias do IAPL (0,7/0,2/0,1 de peso cada). */
function diferencaIapl(iapl: IaplInstituicao, simulada: ValoresIapl, totalBlocoIapl: number): number {
  function fatia(atual: number, sim: number, resto: number, peso: (x: number) => number, participacao: number) {
    const ponderadoAtual = atual * peso(atual);
    const ponderadoSim = sim * peso(sim);
    const somaAtual = resto + ponderadoAtual;
    const somaSim = resto + ponderadoSim;
    const eqAtual = somaAtual > 0 ? (ponderadoAtual / somaAtual) * participacao : 0;
    const eqSim = somaSim > 0 ? (ponderadoSim / somaSim) * participacao : 0;
    return eqSim - eqAtual;
  }
  const tecnico = fatia(iapl.aplTecnico, simulada.tecnico, iapl.restoRedeTecnico, pesoIaplTecnicos, 0.7);
  const formacao = fatia(iapl.aplFormacaoProfessor, simulada.formacao, iapl.restoRedeFormacao, pesoIaplFormacaoProfessores, 0.2);
  const proeja = fatia(iapl.aplProeja, simulada.proeja, iapl.restoRedeProeja, pesoIaplProeja, 0.1);
  return (tecnico + formacao + proeja) * totalBlocoIapl;
}

/**
 * Simulador único: evasão, crescimento de matrícula, RAP e IAPL deixaram de ser
 * seções/alvos separados (pedido do usuário: quer simular vários câmpus ao mesmo
 * tempo e ver o resultado refletir na instituição). Cada instituição e cada câmpus
 * tem seu próprio "+/-" (mesmo esquema do Comparativo): abrir um mostra um quadro
 * com os controles daquela linha, e o efeito de todos os quadros abertos ao mesmo
 * tempo soma no total da instituição (mostrado junto da sigla) e no total da rede
 * (topo da tela). RAP e IAPL são sempre da instituição (nunca de um câmpus
 * isolado, ver /como-funciona#qualidade-eficiencia), então só aparecem no quadro da
 * instituição, não no do câmpus.
 */
export function SimuladorUnificado({
  noRede,
  instituicoes,
  totalBlocoRap,
  totalBlocoIapl,
}: {
  noRede: { recebido: number; perda: number; taxa: number };
  instituicoes: NoInstituicaoSimulavel[];
  totalBlocoRap: number;
  totalBlocoIapl: number;
}) {
  const [rapPorSigla, setRapPorSigla] = useState<Record<string, number>>({});
  const [iaplPorSigla, setIaplPorSigla] = useState<Record<string, ValoresIapl>>({});
  const [reducaoPorCampus, setReducaoPorCampus] = useState<Record<number, number>>({});
  const [crescimentoPorCampus, setCrescimentoPorCampus] = useState<Record<number, number>>({});

  function rapDe(inst: NoInstituicaoSimulavel): number {
    return rapPorSigla[inst.sigla] ?? inst.rap?.rapPresencial ?? 0;
  }
  function iaplDe(inst: NoInstituicaoSimulavel): ValoresIapl {
    return (
      iaplPorSigla[inst.sigla] ?? {
        tecnico: inst.iapl?.aplTecnico ?? 0,
        formacao: inst.iapl?.aplFormacaoProfessor ?? 0,
        proeja: inst.iapl?.aplProeja ?? 0,
      }
    );
  }
  const reducaoDe = (unidadeId: number) => reducaoPorCampus[unidadeId] ?? 0;
  const crescimentoDe = (unidadeId: number) => crescimentoPorCampus[unidadeId] ?? 0;

  function setRap(sigla: string, valor: number) {
    setRapPorSigla((atual) => ({ ...atual, [sigla]: valor }));
  }
  function setIapl(sigla: string, campo: keyof ValoresIapl, valor: number, inst: NoInstituicaoSimulavel) {
    setIaplPorSigla((atual) => ({ ...atual, [sigla]: { ...iaplDe(inst), ...atual[sigla], [campo]: valor } }));
  }
  function setReducao(unidadeId: number, valor: number) {
    setReducaoPorCampus((atual) => ({ ...atual, [unidadeId]: valor }));
  }
  function setCrescimento(unidadeId: number, valor: number) {
    setCrescimentoPorCampus((atual) => ({ ...atual, [unidadeId]: valor }));
  }

  const rollups = useMemo(() => {
    const mapa = new Map<string, { evasao: number; crescimento: number; rap: number; iapl: number; total: number }>();
    for (const inst of instituicoes) {
      const evasao = inst.campi.reduce((s, c) => s + c.perda * (reducaoDe(c.unidadeId) / 100), 0);
      const crescimento = inst.campi.reduce((s, c) => s + c.recebido * (crescimentoDe(c.unidadeId) / 100), 0);
      const rap = inst.rap ? diferencaRap(inst.rap, rapDe(inst), totalBlocoRap) : 0;
      const iapl = inst.iapl ? diferencaIapl(inst.iapl, iaplDe(inst), totalBlocoIapl) : 0;
      mapa.set(inst.sigla, { evasao, crescimento, rap, iapl, total: evasao + crescimento + rap + iapl });
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituicoes, rapPorSigla, iaplPorSigla, reducaoPorCampus, crescimentoPorCampus, totalBlocoRap, totalBlocoIapl]);

  const totalRede = useMemo(() => Array.from(rollups.values()).reduce((s, r) => s + r.total, 0), [rollups]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao rotulo="Perda por evasão hoje, rede inteira" valor={reais.format(noRede.perda)} />
        <Cartao rotulo="Taxa de perda, rede inteira" valor={`${decimal.format(noRede.taxa)}%`} />
        <Cartao
          rotulo="Total simulado, tudo que está aberto"
          valor={`${sinal(totalRede)}${reais.format(totalRede)}`}
          destaque={corSinal(totalRede)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <TabelaOrdenavel
          linhas={instituicoes}
          chaveLinha={(i) => i.sigla}
          linhaExpandida={(inst) => (
            <PainelInstituicao
              inst={inst}
              rapValor={rapDe(inst)}
              onChangeRap={(v) => setRap(inst.sigla, v)}
              iaplValor={iaplDe(inst)}
              onChangeIapl={(campo, v) => setIapl(inst.sigla, campo, v, inst)}
              rollup={rollups.get(inst.sigla)}
              reducaoDe={reducaoDe}
              crescimentoDe={crescimentoDe}
              onChangeReducao={setReducao}
              onChangeCrescimento={setCrescimento}
              totalBlocoRap={totalBlocoRap}
              totalBlocoIapl={totalBlocoIapl}
            />
          )}
          colunas={
            [
              {
                chave: "instituicao",
                rotulo: "Instituição",
                valor: (i) => i.sigla,
                render: (i) => (
                  <span>
                    <span className="font-medium">{i.sigla}</span>
                    <span className="ml-2 text-xs text-neutral-500">{i.nome}</span>
                  </span>
                ),
              },
              {
                chave: "perda",
                rotulo: "Perda por evasão",
                alinhamento: "right",
                valor: (i) => i.perda,
                render: (i) => <span className="text-neutral-600 dark:text-neutral-400">{i.perda > 0 ? reais.format(i.perda) : "-"}</span>,
              },
              {
                chave: "rap",
                rotulo: "RAP Presencial",
                alinhamento: "right",
                valor: (i) => i.rap?.rapPresencial ?? null,
                render: (i) => <span className="text-neutral-600 dark:text-neutral-400">{i.rap ? decimal.format(i.rap.rapPresencial) : "-"}</span>,
              },
              {
                chave: "simulado",
                rotulo: "Efeito simulado",
                alinhamento: "right",
                valor: (i) => rollups.get(i.sigla)?.total ?? 0,
                render: (i) => {
                  const total = rollups.get(i.sigla)?.total ?? 0;
                  return total === 0 ? (
                    <span className="text-neutral-400">-</span>
                  ) : (
                    <span className={`font-medium ${corSinal(total)}`}>
                      {sinal(total)}
                      {reais.format(total)}
                    </span>
                  );
                },
              },
            ] satisfies ColunaOrdenavel<NoInstituicaoSimulavel>[]
          }
        />
      </div>
    </div>
  );
}

function PainelInstituicao({
  inst,
  rapValor,
  onChangeRap,
  iaplValor,
  onChangeIapl,
  rollup,
  reducaoDe,
  crescimentoDe,
  onChangeReducao,
  onChangeCrescimento,
  totalBlocoRap,
  totalBlocoIapl,
}: {
  inst: NoInstituicaoSimulavel;
  rapValor: number;
  onChangeRap: (v: number) => void;
  iaplValor: ValoresIapl;
  onChangeIapl: (campo: keyof ValoresIapl, v: number) => void;
  rollup: { evasao: number; crescimento: number; rap: number; iapl: number; total: number } | undefined;
  reducaoDe: (unidadeId: number) => number;
  crescimentoDe: (unidadeId: number) => number;
  onChangeReducao: (unidadeId: number, v: number) => void;
  onChangeCrescimento: (unidadeId: number, v: number) => void;
  totalBlocoRap: number;
  totalBlocoIapl: number;
}) {
  const total = rollup?.total ?? 0;
  const faixaAtual = inst.rap ? faixaRap(inst.rap.rapPresencial) : null;
  const faixaSimulada = inst.rap ? faixaRap(rapValor) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{inst.sigla}, simulação</h3>
        {total !== 0 && (
          <span className={`text-sm font-medium ${corSinal(total)}`}>
            Efeito total nesta instituição: {sinal(total)}
            {reais.format(total)}
          </span>
        )}
      </div>

      {(inst.rap || inst.iapl) && (
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">RAP e IAPL da instituição</span>
            <Link href="/como-funciona#qualidade-eficiencia" className={PROSE_LINK}>
              como funciona
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {inst.rap ? (
              <SliderControl
                label="RAP Presencial simulada"
                value={rapValor}
                min={10}
                max={30}
                step={0.1}
                onChange={onChangeRap}
                minLabel="10, poucos alunos por professor"
                maxLabel="30, muitos alunos por professor"
                format={(v) => decimal.format(v)}
              />
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Sem indicador de RAP carregado neste ciclo.</p>
            )}
            {inst.iapl ? (
              <div className="flex flex-col gap-3">
                <SliderControl
                  label="%ME Cursos Técnicos"
                  value={iaplValor.tecnico * 100}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => onChangeIapl("tecnico", v / 100)}
                  minLabel="0%"
                  maxLabel="100%"
                  format={(v) => `${Math.round(v)}%`}
                />
                <SliderControl
                  label="%ME Formação de Professores"
                  value={iaplValor.formacao * 100}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => onChangeIapl("formacao", v / 100)}
                  minLabel="0%"
                  maxLabel="100%"
                  format={(v) => `${Math.round(v)}%`}
                />
                <SliderControl
                  label="%ME Proeja"
                  value={iaplValor.proeja * 100}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => onChangeIapl("proeja", v / 100)}
                  minLabel="0%"
                  maxLabel="100%"
                  format={(v) => `${Math.round(v)}%`}
                />
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Sem indicador de IAPL carregado neste ciclo.</p>
            )}
          </div>
          {(inst.rap || inst.iapl) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {inst.rap && (
                <MiniCartao rotulo="Faixa RAP" valor={faixaSimulada ? ROTULO_FAIXA[faixaSimulada] : "-"} pequena />
              )}
              {inst.rap && (
                <MiniCartao rotulo="Diferença, RAP" valor={`${sinal(rollup?.rap ?? 0)}${reais.format(rollup?.rap ?? 0)}`} destaque={corSinal(rollup?.rap ?? 0)} />
              )}
              {inst.iapl && (
                <MiniCartao rotulo="Diferença, IAPL" valor={`${sinal(rollup?.iapl ?? 0)}${reais.format(rollup?.iapl ?? 0)}`} destaque={corSinal(rollup?.iapl ?? 0)} />
              )}
            </div>
          )}
          {faixaAtual && faixaSimulada && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Faixa RAP hoje: {ROTULO_FAIXA[faixaAtual]}.
            </p>
          )}
        </div>
      )}

      {inst.campi.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Câmpus</span>
          <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <TabelaOrdenavel
              linhas={inst.campi}
              chaveLinha={(c) => c.unidadeId}
              linhaExpandida={(c) => (
                <PainelCampus
                  campus={c}
                  reducao={reducaoDe(c.unidadeId)}
                  crescimento={crescimentoDe(c.unidadeId)}
                  onChangeReducao={(v) => onChangeReducao(c.unidadeId, v)}
                  onChangeCrescimento={(v) => onChangeCrescimento(c.unidadeId, v)}
                />
              )}
              colunas={
                [
                  { chave: "nome", rotulo: "Câmpus", valor: (c) => c.nome },
                  {
                    chave: "recebido",
                    rotulo: "Recebido",
                    alinhamento: "right",
                    valor: (c) => c.recebido,
                    render: (c) => reais.format(c.recebido),
                  },
                  {
                    chave: "perda",
                    rotulo: "Perda",
                    alinhamento: "right",
                    valor: (c) => c.perda,
                    render: (c) => reais.format(c.perda),
                  },
                  {
                    chave: "simulado",
                    rotulo: "Efeito simulado",
                    alinhamento: "right",
                    valor: (c) => c.perda * (reducaoDe(c.unidadeId) / 100) + c.recebido * (crescimentoDe(c.unidadeId) / 100),
                    render: (c) => {
                      const efeito = c.perda * (reducaoDe(c.unidadeId) / 100) + c.recebido * (crescimentoDe(c.unidadeId) / 100);
                      return efeito === 0 ? (
                        <span className="text-neutral-400">-</span>
                      ) : (
                        <span className={corSinal(efeito)}>
                          {sinal(efeito)}
                          {reais.format(efeito)}
                        </span>
                      );
                    },
                  },
                ] satisfies ColunaOrdenavel<NoCampusSimulavel>[]
              }
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nenhum câmpus com 6ª fase carregada para esta instituição neste ciclo.
        </p>
      )}
    </div>
  );
}

function PainelCampus({
  campus,
  reducao,
  crescimento,
  onChangeReducao,
  onChangeCrescimento,
}: {
  campus: NoCampusSimulavel;
  reducao: number;
  crescimento: number;
  onChangeReducao: (v: number) => void;
  onChangeCrescimento: (v: number) => void;
}) {
  const recuperadoEvasao = campus.perda * (reducao / 100);
  const ganhoCrescimento = campus.recebido * (crescimento / 100);
  const total = recuperadoEvasao + ganhoCrescimento;
  const novoRecebido = campus.recebido + recuperadoEvasao + ganhoCrescimento;
  const novaPerda = campus.perda - recuperadoEvasao;
  const taxaAtual = pct(campus.perda, campus.recebido);
  const novaTaxa = pct(novaPerda, novoRecebido);

  return (
    <div className="flex flex-col gap-3">
      {campus.estaNoPiso && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>{campus.nome}</strong> já está travado no Piso Mínimo (R$ 700.000), não no valor
          calculado pela matrícula. Reduzir a evasão ou simular crescimento aqui pode não mudar nada o
          que este câmpus recebe de verdade.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SliderControl
          label="Redução simulada da evasão"
          value={reducao}
          min={0}
          max={100}
          step={5}
          onChange={onChangeReducao}
          minLabel="0%, sem mudança"
          maxLabel="100%, evasão zerada"
          format={(v) => `${v}%`}
        />
        <SliderControl
          label="Crescimento simulado da matrícula"
          value={crescimento}
          min={0}
          max={50}
          step={5}
          onChange={onChangeCrescimento}
          minLabel="0%, sem mudança"
          maxLabel="+50%"
          format={(v) => `${v}%`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniCartao rotulo="Recebido hoje" valor={reais.format(campus.recebido)} />
        <MiniCartao rotulo="Recuperado, evasão" valor={reais.format(recuperadoEvasao)} destaque="text-if-green" />
        <MiniCartao rotulo="Ganho, crescimento" valor={reais.format(ganhoCrescimento)} destaque="text-if-green" />
        <MiniCartao rotulo="Efeito total do câmpus" valor={`${sinal(total)}${reais.format(total)}`} destaque={corSinal(total)} />
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Taxa de perda: {decimal.format(taxaAtual)}% hoje → {decimal.format(novaTaxa)}% no cenário.
      </p>
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  minLabel,
  maxLabel,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
  format: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="flex items-baseline justify-between font-medium text-neutral-900 dark:text-neutral-100">
        <span>{label}</span>
        <span className="tabular-nums text-if-green">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-if-green dark:bg-neutral-800"
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
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

function MiniCartao({ rotulo, valor, destaque, pequena }: { rotulo: string; valor: string; destaque?: string; pequena?: boolean }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{rotulo}</div>
      <div className={`mt-0.5 tabular-nums ${pequena ? "text-xs" : "text-sm font-semibold"} ${destaque ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {valor}
      </div>
    </div>
  );
}
