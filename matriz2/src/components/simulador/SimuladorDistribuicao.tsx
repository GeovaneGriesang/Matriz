"use client";

import { useMemo, useState } from "react";
import { EXPLICACAO_INDICE, ROTULO_INDICE, type ChaveIndice, type IndicesCampus } from "@/lib/mdo/indicesCampus";
import { matrizPct, planoLinear, planoValido, simularTransicao, type CampusDistribuicao, type PlanoAno } from "@/lib/mdo/transicaoDistribuicao";

export interface CampusEntrada {
  id: number;
  nome: string;
  /** Valor recebido no ano anterior; `null` quando o câmpus é novo. */
  informado: number | null;
  matriz: number;
  indices: IndicesCampus | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function sinal(v: number) {
  return v >= 0 ? "+" : "-";
}
function corDelta(v: number) {
  if (Math.abs(v) < 1) return "text-neutral-500";
  return v > 0 ? "text-if-green" : "text-if-red dark:text-red-400";
}

export function SimuladorDistribuicao({
  campi,
  anoBase,
  anoAlvo,
  fonteInformado,
  temIndices,
  totalPadrao,
  instituicao,
}: {
  campi: CampusEntrada[];
  anoBase: number;
  anoAlvo: number;
  fonteInformado: "informado" | "matriz-anterior";
  temIndices: boolean;
  totalPadrao: number;
  instituicao: string;
}) {
  const [mantido, setMantido] = useState(80);
  const [anos, setAnos] = useState(3);
  const [chaveIndice, setChaveIndice] = useState<ChaveIndice | "nenhum">(temIndices ? "eficiencia" : "nenhum");
  const [pesoIndice, setPesoIndice] = useState(50);
  const [crescimento, setCrescimento] = useState(0);
  const [manual, setManual] = useState<Record<number, Partial<PlanoAno>>>({});

  const planoAuto = useMemo(() => planoLinear(mantido, chaveIndice === "nenhum" ? 0 : pesoIndice / 100, anos), [mantido, pesoIndice, anos, chaveIndice]);
  const plano: PlanoAno[] = planoAuto.map((p, i) => ({ ...p, ...manual[i] }));
  const planoOk = plano.every(planoValido);
  const foiEditado = Object.keys(manual).length > 0;

  const entrada: CampusDistribuicao[] = campi.map((c) => ({
    id: c.id,
    nome: c.nome,
    informado: c.informado ?? 0,
    matriz: c.matriz,
    indice: chaveIndice === "nenhum" ? 1 : (c.indices?.[chaveIndice] ?? 0),
  }));
  const totais = plano.map((_, i) => totalPadrao * Math.pow(1 + crescimento / 100, i));
  const resultado = useMemo(
    () => (planoOk ? simularTransicao(entrada, totais, plano) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planoOk, mantido, anos, chaveIndice, pesoIndice, crescimento, manual, campi, totalPadrao],
  );

  const somaInformado = campi.reduce((s, c) => s + (c.informado ?? 0), 0);
  const somaMatriz = campi.reduce((s, c) => s + c.matriz, 0);

  function editar(i: number, campo: "mantidoPct" | "indicePct", valor: number) {
    setManual((atual) => ({ ...atual, [i]: { ...atual[i], [campo]: Math.max(0, Math.min(100, valor)) } }));
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="col-span-full text-sm font-semibold text-neutral-900 dark:text-neutral-100">Como será a transição</h2>
        <Controle rotulo="Manter do ano anterior, no 1º ano" valor={mantido} min={0} max={100} passo={5} formato={(v) => `${v}%`} onChange={(v) => { setMantido(v); setManual({}); }} ajuda="Parte do orçamento distribuída na proporção do que cada câmpus recebeu antes (70 a 80% é o usual)" />
        <Controle rotulo="Anos até chegar a 100% da matriz" valor={anos} min={1} max={6} passo={1} formato={(v) => `${v}`} onChange={(v) => { setAnos(v); setManual({}); }} ajuda="No último ano, tudo vai pela matriz" />
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Índice para completar</span>
          <select
            value={chaveIndice}
            onChange={(e) => { setChaveIndice(e.target.value as ChaveIndice | "nenhum"); setManual({}); }}
            className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="nenhum">Nenhum, só a matriz</option>
            {temIndices &&
              (Object.keys(ROTULO_INDICE) as ChaveIndice[]).map((k) => (
                <option key={k} value={k}>
                  {ROTULO_INDICE[k]}
                </option>
              ))}
          </select>
          <span className="text-xs text-neutral-500">
            {chaveIndice === "nenhum"
              ? temIndices
                ? "O que não é mantido vai pela matriz de cada câmpus."
                : "Índices de qualidade só existem para instituições com a 2ª fase carregada (hoje, o IFSul)."
              : EXPLICACAO_INDICE[chaveIndice]}
          </span>
        </div>
        {chaveIndice !== "nenhum" ? (
          <Controle rotulo="Peso do índice no que não é mantido" valor={pesoIndice} min={0} max={100} passo={10} formato={(v) => `${v}%`} onChange={(v) => { setPesoIndice(v); setManual({}); }} ajuda="O restante vai pela matriz pura; o peso cai a zero até o último ano" />
        ) : (
          <div />
        )}
        <Controle rotulo="Crescimento do orçamento por ano" valor={crescimento} min={-10} max={20} passo={1} formato={(v) => `${v}%`} onChange={setCrescimento} ajuda={`Parte de ${reais.format(totalPadrao)} (a soma da matriz dos câmpus em ${anoAlvo})`} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Plano por ano (pode ajustar cada número)</h2>
          {foiEditado && (
            <button type="button" onClick={() => setManual({})} className="text-xs font-medium text-if-green underline">
              voltar ao plano automático
            </button>
          )}
        </div>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Ano</th>
                <th className="px-3 py-2 text-right">Mantido do informado ({anoBase})</th>
                <th className="px-3 py-2 text-right">Matriz com índice</th>
                <th className="px-3 py-2 text-right">Matriz pura</th>
                <th className="px-3 py-2 text-right">Orçamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {plano.map((p, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 tabular-nums">{anoAlvo + i}</td>
                  <td className="px-3 py-1.5 text-right"><Campo valor={p.mantidoPct} onChange={(v) => editar(i, "mantidoPct", v)} /></td>
                  <td className="px-3 py-1.5 text-right"><Campo valor={p.indicePct} onChange={(v) => editar(i, "indicePct", v)} desabilitado={chaveIndice === "nenhum"} /></td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${matrizPct(p) < -1e-9 ? "text-if-red" : ""}`}>{decimal.format(Math.max(0, matrizPct(p)))}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(totais[i]!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!planoOk && <p className="text-sm text-if-red">Em algum ano o mantido e o índice passam de 100%. Reduza um dos dois.</p>}
      </section>

      {fonteInformado === "matriz-anterior" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Ninguém cadastrou o valor informado de {anoBase} para {instituicao} (em <em>Admin, Valores recebidos</em>). Enquanto isso, o
          &quot;informado&quot; é a matriz de {anoBase} de cada câmpus.
        </p>
      )}
      {somaInformado === 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Sem nenhum valor de {anoBase} para os câmpus, a parte mantida não tem como ser distribuída e vai pela matriz.
        </p>
      )}

      {resultado && (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Quanto cada câmpus recebe</h2>
          <div className="tabela-rolavel">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-2 pr-3">Câmpus</th>
                  <th className="px-3 py-2 text-right">Informado {anoBase}</th>
                  {plano.map((_, i) => (
                    <th key={i} className="px-3 py-2 text-right">{anoAlvo + i}</th>
                  ))}
                  <th className="px-3 py-2 text-right">Matriz pura</th>
                  <th className="px-3 py-2 text-right">Muda até o fim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {campi.map((c, idx) => {
                  const base = c.informado ?? 0;
                  const ultimo = resultado.anos[resultado.anos.length - 1]!.valores[idx]!;
                  // O que o câmpus receberia no último ano se mantivesse a fatia do informado.
                  const seMantivesse = somaInformado > 0 ? (base / somaInformado) * totais[totais.length - 1]! : 0;
                  const deltaFim = base > 0 ? ultimo - seMantivesse : 0;
                  return (
                    <tr key={c.id}>
                      <td className="py-1.5 pr-3">{c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                        {c.informado === null ? "novo" : reais.format(c.informado)}
                        {c.informado !== null && somaInformado > 0 && (
                          <span className="ml-1 text-xs text-neutral-500">({decimal.format((c.informado / somaInformado) * 100)}%)</span>
                        )}
                      </td>
                      {resultado.anos.map((a, i) => (
                        <td key={i} className="px-3 py-1.5 text-right tabular-nums">
                          {reais.format(a.valores[idx]!)}
                          <span className="ml-1 text-xs text-neutral-500">({decimal.format(a.fatias[idx]! * 100)}%)</span>
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                        {reais.format(c.matriz)}
                        <span className="ml-1 text-xs text-neutral-500">({decimal.format((c.matriz / Math.max(1, somaMatriz)) * 100)}%)</span>
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${corDelta(deltaFim)}`}>
                        {base > 0 ? `${sinal(deltaFim)}${reais.format(Math.abs(deltaFim))}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-neutral-300 font-semibold dark:border-neutral-700">
                <tr>
                  <td className="py-2 pr-3">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(somaInformado)}</td>
                  {resultado.somaPorAno.map((s, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums">{reais.format(s)}</td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(somaMatriz)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-neutral-500">
            Os percentuais entre parênteses são a fatia de cada câmpus no total. A coluna &quot;Muda até o fim&quot; compara o último ano
            com o que o câmpus receberia se mantivesse a mesma fatia do informado de {anoBase}: mostra quem ganha e quem perde com a
            mudança de critério, sem misturar com o crescimento do orçamento.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Como esta conta é feita</h2>
        <p>
          O orçamento de {instituicao} para o Funcionamento se reparte, em cada ano, em três partes que somam 100%: o{" "}
          <strong>mantido</strong> (distribuído na proporção do que cada câmpus recebeu em {anoBase}), o <strong>índice</strong>{" "}
          (a matriz de cada câmpus multiplicada por um índice de qualidade e eficiência, o que premia quem entrega mais
          resultado) e a <strong>matriz pura</strong> (matrícula equalizada, a regra final). O plano automático desce em linha
          reta: o mantido cai do valor escolhido até zero, e no último ano tudo vai pela matriz.
        </p>
        <p>
          Só a <em>proporção</em> do informado importa, não o valor em reais: o orçamento total é o da matriz, e a conta sempre
          fecha nele (a soma dos câmpus é igual ao orçamento em todos os anos). Nada é criado nem some: o que um câmpus ganha,
          outro perde.
        </p>
      </section>
    </div>
  );
}

function Campo({ valor, onChange, desabilitado }: { valor: number; onChange: (v: number) => void; desabilitado?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={Math.round(valor * 10) / 10}
        min={0}
        max={100}
        step={1}
        disabled={desabilitado}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-right tabular-nums disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900"
      />
      %
    </span>
  );
}

function Controle({ rotulo, valor, min, max, passo, formato, onChange, ajuda }: { rotulo: string; valor: number; min: number; max: number; passo: number; formato: (v: number) => string; onChange: (v: number) => void; ajuda?: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="flex items-baseline justify-between font-medium text-neutral-900 dark:text-neutral-100">
        <span>{rotulo}</span>
        <span className="tabular-nums text-if-green">{formato(valor)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-if-green dark:bg-neutral-800"
        aria-label={rotulo}
      />
      {ajuda && <span className="text-xs text-neutral-500">{ajuda}</span>}
    </div>
  );
}
