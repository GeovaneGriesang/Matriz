"use client";

import { Fragment, useMemo, useState } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { ehCampusDestaque } from "@/lib/destaque";
import { PROPOSTAS_DE_TRANSICAO, transicaoDoCampus, type PropostaDeTransicao } from "@/lib/mdo/transicaoCumulativa";
import { PROPOSTA_V01 } from "@/lib/mdo/propostaComplementacao";
import { PropostaComplementacao, resultadoDaV01 } from "@/components/simulador/PropostaComplementacao";

export interface CampusDaTransicao {
  id: number;
  nome: string;
  /** Valor informado de 2026; nulo se o câmpus não recebeu nada (câmpus novo). */
  base: number | null;
  matriz2027: number;
  /** Matriz de 2027 em diante pela projeção dos cursos, um valor por ano. */
  matrizesPelaProjecao: number[];
  /** Falso quando o câmpus não tem ciclos para projetar (recebe só o Piso Mínimo). */
  temCiclos: boolean;
}

type Cenario = "constante" | "projecao";
type Visao = string; // o id de uma proposta, "versao-01" ou "comparar"

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
const fracao = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

const cor = (v: number) => (Math.abs(v) < 0.005 ? "text-neutral-500" : v > 0 ? "text-if-green" : "text-if-red dark:text-red-400");
const th = "whitespace-nowrap px-2 py-1.5 text-right font-medium";
const td = "whitespace-nowrap px-2 py-1 text-right tabular-nums";
const borda = "border-l border-neutral-200 dark:border-neutral-800";

const botao = (ativo: boolean) =>
  `rounded px-3 py-1.5 font-medium ${ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`;

function trajetoria(c: CampusDaTransicao, proposta: PropostaDeTransicao, cenario: Cenario) {
  const matrizes = cenario === "constante" ? proposta.etapas.map(() => c.matriz2027) : c.matrizesPelaProjecao;
  return transicaoDoCampus(c.base ?? 0, matrizes, proposta.etapas);
}

export function TransicaoProposta({ campi }: { campi: CampusDaTransicao[] }) {
  const [visao, setVisao] = useState<Visao>(PROPOSTAS_DE_TRANSICAO[0]!.id);
  const [cenario, setCenario] = useState<Cenario>("constante");
  const proposta = PROPOSTAS_DE_TRANSICAO.find((p) => p.id === visao) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Proposta</span>
        {PROPOSTAS_DE_TRANSICAO.map((p) => (
          <button key={p.id} type="button" onClick={() => setVisao(p.id)} aria-pressed={visao === p.id} className={botao(visao === p.id)}>
            {p.campus}
          </button>
        ))}
        <button type="button" onClick={() => setVisao(PROPOSTA_V01.id)} aria-pressed={visao === PROPOSTA_V01.id} className={botao(visao === PROPOSTA_V01.id)}>
          {PROPOSTA_V01.rotulo}
        </button>
        <button type="button" onClick={() => setVisao("comparar")} aria-pressed={visao === "comparar"} className={botao(visao === "comparar")}>
          Comparar as propostas
        </button>
      </div>

      {visao === PROPOSTA_V01.id ? (
        <PropostaComplementacao campi={campi} />
      ) : (
      <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Matriz dos anos seguintes</span>
        {(
          [
            ["constante", "Igual à de 2027"],
            ["projecao", "Pela projeção dos cursos de cada câmpus"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button key={valor} type="button" onClick={() => setCenario(valor)} aria-pressed={cenario === valor} className={botao(cenario === valor)}>
            {rotulo}
          </button>
        ))}
      </div>
      <p className="max-w-4xl text-sm text-neutral-600 dark:text-neutral-400">
        A matriz de 2027 é a da 5ª fase da MDO, nas propostas de transição.{" "}
        {cenario === "constante"
          ? "Nos anos seguintes ela fica igual à de 2027, sem inflação nem mudança de matrículas: mostra só o efeito da regra de transição."
          : "Nos anos seguintes ela acompanha o que os cursos de cada câmpus rendem: as turmas em andamento até terminarem, com a evasão média do IFSul, e a reposição das turmas. O valor da matrícula fica o de hoje; o orçamento da rede e as matrículas dos outros institutos não são conhecidos. É uma estimativa, não a matriz oficial desses anos."}
      </p>

      {proposta ? <TabelaDaProposta key={proposta.id} campi={campi} proposta={proposta} cenario={cenario} /> : <Comparacao campi={campi} cenario={cenario} />}
      </>
      )}
    </div>
  );
}

function TabelaDaProposta({ campi, proposta, cenario }: { campi: CampusDaTransicao[]; proposta: PropostaDeTransicao; cenario: Cenario }) {
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const etapas = proposta.etapas;
  const ultimoAno = etapas[etapas.length - 1]!.ano;

  const linhas = useMemo(
    () =>
      campi.map((c) => {
        const anos = trajetoria(c, proposta, cenario);
        return { ...c, baseValor: c.base ?? 0, anos, final: anos[anos.length - 1]!.valor };
      }),
    [campi, proposta, cenario],
  );

  const somaBase = linhas.reduce((s, l) => s + l.baseValor, 0);
  const somas = etapas.map((_, i) => ({
    matriz: linhas.reduce((s, l) => s + l.anos[i]!.matriz, 0),
    valor: linhas.reduce((s, l) => s + l.anos[i]!.valor, 0),
  }));
  const somaFinal = somas[somas.length - 1]!.valor;
  const exemplo = linhas.find((l) => ehCampusDestaque(l.nome)) ?? linhas[0] ?? null;

  return (
    <>
      <div className="flex max-w-4xl flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
        <p>
          <strong>Documento:</strong> &quot;{proposta.documento}&quot;, do {proposta.campus}.
        </p>
        <p>{proposta.regra}</p>
        {proposta.ressalvas.map((r) => (
          <p key={r} className="text-amber-800 dark:text-amber-300">
            {r}
          </p>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1 text-left font-medium" rowSpan={2}>Câmpus</th>
              <th className={th} rowSpan={2}>Base 2026</th>
              {etapas.map((e) => (
                <th key={e.ano} className={`${borda} px-2 py-1 text-center font-medium`} colSpan={3}>
                  {e.ano} ({e.fracao === 0 ? "mantém o valor de 2026" : e.fracao === 1 ? "100% da matriz" : `incorpora ${fracao.format(e.fracao)} da diferença`})
                </th>
              ))}
              <th className={`${borda} px-2 py-1 text-center font-medium`} colSpan={2}>{ultimoAno} contra 2026</th>
            </tr>
            <tr>
              {etapas.map((e) => (
                <CabecalhoDoAno key={e.ano} />
              ))}
              <th className={`${th} ${borda}`}>R$</th>
              <th className={th}>%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {linhas.map((l) => {
              const dif = l.final - l.baseValor;
              return (
                <Fragment key={l.id}>
                <tr className={l.id === abertoId ? "bg-if-green/10" : ehCampusDestaque(l.nome) ? "bg-if-green/5" : undefined}>
                  <td className="whitespace-nowrap px-2 py-1 text-left">
                    <button type="button" onClick={() => setAbertoId(l.id === abertoId ? null : l.id)} aria-expanded={l.id === abertoId} className="inline-flex items-center gap-2 font-medium hover:text-if-green">
                      <SinalMaisMenos aberto={l.id === abertoId} />
                      {l.nome}
                    </button>
                  </td>
                  <td className={td}>{l.base === null ? "sem base" : reais.format(l.base)}</td>
                  {l.anos.map((a) => (
                    <CelulasDoAno key={a.ano} matriz={a.matriz} valor={a.valor} variacao={a.variacao} />
                  ))}
                  <td className={`${td} ${borda} ${cor(dif)}`}>{reais.format(dif)}</td>
                  <td className={`${td} ${cor(dif)}`}>{l.baseValor > 0 ? pct.format(dif / l.baseValor) : ""}</td>
                </tr>
                {l.id === abertoId && (
                  <tr data-detalhe="1">
                    <td colSpan={etapas.length * 3 + 4} className="bg-neutral-100 p-3 dark:bg-neutral-900/60">
                      <ContaDoCampus campus={l} anos={l.anos} proposta={proposta} cenario={cenario} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
            <tr>
              <td className="px-2 py-1 text-left">Soma dos câmpus</td>
              <td className={td}>{reais.format(somaBase)}</td>
              {somas.map((s, i) => {
                const anterior = i === 0 ? somaBase : somas[i - 1]!.valor;
                return <CelulasDoAno key={i} matriz={s.matriz} valor={s.valor} variacao={anterior > 0 ? s.valor / anterior - 1 : null} />;
              })}
              <td className={`${td} ${borda} ${cor(somaFinal - somaBase)}`}>{reais.format(somaFinal - somaBase)}</td>
              <td className={`${td} ${cor(somaFinal - somaBase)}`}>{somaBase > 0 ? pct.format(somaFinal / somaBase - 1) : ""}</td>
            </tr>
            <tr className="font-normal">
              <td className="px-2 py-1 text-left">Soma da proposta menos a soma da matriz</td>
              <td className={td}></td>
              {somas.map((s, i) => (
                <td key={i} className={`${td} ${borda} ${cor(s.valor - s.matriz)}`} colSpan={3}>
                  {reais.format(s.valor - s.matriz)}
                </td>
              ))}
              <td className={`${td} ${borda}`} colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="max-w-4xl text-xs text-neutral-500 dark:text-neutral-400">
        A conta não reparte um total fixo: cada câmpus anda em direção à própria matriz. Por isso a soma dos câmpus pode não ser igual à soma da matriz, e a última linha mostra a diferença. Só entra o
        Funcionamento dos câmpus: Reitoria, Qualidade e Eficiência e Assistência Estudantil ficam de fora. Clique no + de um câmpus para ver a conta dele logo abaixo da linha, e no − para fechar.
        {exemplo && ` Exemplo: o + de ${exemplo.nome} mostra como ${reais.format(exemplo.baseValor)} de 2026 chegam a ${reais.format(exemplo.final)} em ${ultimoAno}.`}
      </p>

    </>
  );
}

/** A conta de um câmpus, ano a ano, no quadro logo abaixo da linha dele. */
function ContaDoCampus({ campus, anos, proposta, cenario }: { campus: CampusDaTransicao; anos: ReturnType<typeof trajetoria>; proposta: PropostaDeTransicao; cenario: Cenario }) {
  return (
    <div className="sticky left-0 flex w-[min(88vw,60rem)] flex-col gap-2 whitespace-normal rounded-md border-l-4 border-if-green bg-white p-4 text-left text-sm dark:bg-neutral-950">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
        A conta de {campus.nome}, na proposta do {proposta.campus}
      </h3>
      {campus.base === null && <p className="text-amber-800 dark:text-amber-300">Este câmpus não tem valor em 2026: a transição parte de zero.</p>}
      {!campus.temCiclos && cenario === "projecao" && <p className="text-amber-800 dark:text-amber-300">Sem ciclos para projetar: a matriz fica igual à de 2027.</p>}
      <ul className="flex flex-col gap-1 text-neutral-700 dark:text-neutral-300">
        {anos.map((a) =>
          a.fracao === 0 ? (
            <li key={a.ano}>
              <strong>{a.ano}:</strong> mantém o valor de 2026 = <strong>{reais.format(a.valor)}</strong>
            </li>
          ) : a.fracao === 1 ? (
            <li key={a.ano}>
              <strong>{a.ano}:</strong> adota a matriz do ano inteira = <strong>{reais.format(a.valor)}</strong>
            </li>
          ) : (
            <li key={a.ano}>
              <strong>{a.ano}:</strong> {reais.format(a.base)} + {fracao.format(a.fracao)} × ({reais.format(a.matriz)} − {reais.format(a.base)}) = {reais.format(a.base)} {a.acrescimo < 0 ? "−" : "+"}{" "}
              {reais.format(Math.abs(a.acrescimo))} = <strong>{reais.format(a.valor)}</strong>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/** As duas propostas lado a lado, nos anos que existem em cada uma. */
function Comparacao({ campi, cenario }: { campi: CampusDaTransicao[]; cenario: Cenario }) {
  const [sapucaia, venancio] = [PROPOSTAS_DE_TRANSICAO[0]!, PROPOSTAS_DE_TRANSICAO[1]!];
  const anos = [2027, 2028, 2029, 2030];
  const v01 = new Map(resultadoDaV01(campi, "documento").linhas.map((l) => [l.id, l.total]));
  const linhas = campi.map((c) => {
    const a = new Map(trajetoria(c, sapucaia, cenario).map((t) => [t.ano, t.valor]));
    const b = new Map(trajetoria(c, venancio, cenario).map((t) => [t.ano, t.valor]));
    return { ...c, a, b, v01: v01.get(c.id) ?? null };
  });
  const soma = (f: (l: (typeof linhas)[number]) => number) => linhas.reduce((s, l) => s + f(l), 0);
  // Depois de 2029, a proposta do Sapucaia segue na matriz do ano.
  const matrizDe = (c: CampusDaTransicao, ano: number) => (cenario === "constante" ? c.matriz2027 : (c.matrizesPelaProjecao[ano - 2027] ?? c.matriz2027));
  const valorA = (l: (typeof linhas)[number], ano: number) => l.a.get(ano) ?? matrizDe(l, ano);

  return (
    <>
      <p className="max-w-4xl text-sm text-neutral-700 dark:text-neutral-300">
        As duas propostas de transição partem do mesmo valor de 2026 e da mesma matriz. A do {sapucaia.campus} termina em 2029, e em 2030 fica na matriz do ano; a do {venancio.campus} vai até 2030, sem chegar à matriz. A proposta oficial da Reitoria (versão 01) vale só para 2027 e usa a Matriz 1 do documento, com o EaD reclassificado: aparece só na coluna de 2027.
      </p>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-2 py-1 text-left font-medium" rowSpan={2}>Câmpus</th>
              <th className={th} rowSpan={2}>Base 2026</th>
              {anos.map((ano) => (
                <th key={ano} className={`${borda} px-2 py-1 text-center font-medium`} colSpan={ano === 2027 ? 3 : 2}>{ano}</th>
              ))}
              <th className={`${borda} px-2 py-1 text-center font-medium`} colSpan={2}>2030 contra 2026</th>
            </tr>
            <tr>
              {anos.map((ano) => (
                <ParDeCabecalho key={ano} comV01={ano === 2027} />
              ))}
              <ParDeCabecalho />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {linhas.map((l) => {
              const base = l.base ?? 0;
              const fimA = valorA(l, 2030);
              const fimB = l.b.get(2030)!;
              return (
                <tr key={l.id} className={ehCampusDestaque(l.nome) ? "bg-if-green/5" : undefined}>
                  <td className="whitespace-nowrap px-2 py-1 text-left font-medium">{l.nome}</td>
                  <td className={td}>{l.base === null ? "sem base" : reais.format(l.base)}</td>
                  {anos.map((ano) => (
                    <ParDeValores key={ano} a={valorA(l, ano)} b={l.b.get(ano)!} c={ano === 2027 ? l.v01 : undefined} />
                  ))}
                  <td className={`${td} ${borda} ${cor(fimA - base)}`}>{base > 0 ? pct.format(fimA / base - 1) : ""}</td>
                  <td className={`${td} ${cor(fimB - base)}`}>{base > 0 ? pct.format(fimB / base - 1) : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-50 font-medium dark:bg-neutral-900">
            <tr>
              <td className="px-2 py-1 text-left">Soma dos câmpus</td>
              <td className={td}>{reais.format(soma((l) => l.base ?? 0))}</td>
              {anos.map((ano) => (
                <ParDeValores key={ano} a={soma((l) => valorA(l, ano))} b={soma((l) => l.b.get(ano)!)} c={ano === 2027 ? soma((l) => l.v01 ?? 0) : undefined} />
              ))}
              <td className={`${td} ${borda}`}></td>
              <td className={td}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function CabecalhoDoAno() {
  return (
    <>
      <th className={`${th} ${borda}`}>Matriz</th>
      <th className={th}>Proposta</th>
      <th className={th}>Var.</th>
    </>
  );
}

function CelulasDoAno({ matriz, valor, variacao }: { matriz: number; valor: number; variacao: number | null }) {
  return (
    <>
      <td className={`${td} ${borda} text-neutral-500 dark:text-neutral-400`}>{reais.format(matriz)}</td>
      <td className={`${td} font-medium`}>{reais.format(valor)}</td>
      <td className={`${td} ${variacao === null ? "" : cor(variacao * 100)}`}>{variacao === null ? "" : pct.format(variacao)}</td>
    </>
  );
}

function ParDeCabecalho({ comV01 = false }: { comV01?: boolean }) {
  return (
    <>
      <th className={`${th} ${borda}`}>Sapucaia</th>
      <th className={th}>V. Aires</th>
      {comV01 && <th className={th}>Versão 01</th>}
    </>
  );
}

/** `c`: o valor da versão 01, só em 2027 (nulo quando o câmpus fica fora dela). */
function ParDeValores({ a, b, c }: { a: number; b: number; c?: number | null }) {
  return (
    <>
      <td className={`${td} ${borda}`}>{reais.format(a)}</td>
      <td className={td}>{reais.format(b)}</td>
      {c !== undefined && <td className={td}>{c === null ? "fora" : reais.format(c)}</td>}
    </>
  );
}
