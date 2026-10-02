"use client";

import { useMemo, useState } from "react";
import {
  eixoDeAnos,
  melhores,
  resultadoDaAlternativa,
  type Alternativa,
  type AlternativaCurso,
  type AlternativaEvasao,
  type AlternativaIndicador,
  type AlternativaMatricula,
  type ContextoAlternativas,
  type ResultadoAlternativa,
} from "@/lib/alternativas";
import { faixaRap } from "@/lib/qualidadeEficiencia";
import {
  ROTULO_INDICADOR,
  proximoDegrau,
  valorAtualDoIndicador,
  type IndicadorSimulavel,
} from "@/lib/simulacaoIndicadores";
import type { ItemCatalogo } from "@/server/queries/contextoSimulador";

export type ContextoBase = Omit<ContextoAlternativas, "reajusteAnual">;

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const ROTULO_FAIXA_RAP = { MUITO_BAIXA: "muito baixa (abaixo de 18)", BAIXA: "baixa (18 a 20)", MEDIA: "média (20 a 22)", MUITO_ALTA: "muito alta (22 ou mais)" } as const;

let contador = 0;
const novoId = () => `alt-${++contador}`;

function sufixoDuracao(o: { anosDuracao: number; mesesDuracao?: number }): string {
  return o.mesesDuracao ? `${o.mesesDuracao} meses` : `${o.anosDuracao} anos`;
}

function cursoDoCatalogo(ref: ItemCatalogo, primeiroAno: number, extra: Partial<AlternativaCurso["opcao"]> = {}, rotulo?: string): AlternativaCurso {
  const p = ref.padroes;
  const opcao = {
    rotulo: ref.rotulo,
    anosDuracao: p.anosDuracao,
    mesesDuracao: p.mesesDuracao,
    chTotalCiclo: p.chTotal,
    chMatriz: p.teto,
    vagasPorAno: p.vagasPorAno,
    evasaoAnual: 0,
    ...extra,
  };
  return { tipo: "CURSO", id: novoId(), rotulo: rotulo ?? `${ref.rotulo}, ${sufixoDuracao(opcao)}`, primeiroAno, peso: ref.peso, referencia: ref.chave, opcao };
}

function alternativasIniciais(catalogo: ItemCatalogo[], ctx: ContextoBase, ano: number): Alternativa[] {
  const achar = (chave: string) => catalogo.find((c) => c.chave === chave);
  const integrado =
    achar("TECNICO|INTEGRADO|TECNICO EM ELETROMECANICA|1200") ?? catalogo.find((c) => c.tipoCurso === "TECNICO" && c.tipoOferta === "INTEGRADO");
  const fic = catalogo.find((c) => c.tipoCurso.startsWith("QUALIFICA") && c.chMinimaMec > 0 && c.chMinimaMec <= 400);
  const lista: Alternativa[] = [];
  if (integrado) {
    const teto = integrado.padroes.teto;
    lista.push(
      cursoDoCatalogo(integrado, ano, { anosDuracao: 3, chTotalCiclo: Math.min(3000, teto) }, `Integrado em 3 anos (${integrado.rotulo})`),
      cursoDoCatalogo(integrado, ano, { anosDuracao: 4, chTotalCiclo: teto }, `Integrado em 4 anos (${integrado.rotulo})`),
    );
  }
  if (ctx.indicadores.rap) {
    const atual = ctx.indicadores.rap.rapPresencial;
    const proximo = proximoDegrau("RAP", atual);
    lista.push({
      tipo: "INDICADOR",
      id: novoId(),
      rotulo: "Melhorar a RAP até o próximo degrau",
      primeiroAno: ano,
      indicador: "RAP",
      novoValor: proximo ? Math.round((proximo.valor + 0.01) * 100) / 100 : atual,
    });
  }
  if (fic) {
    lista.push(cursoDoCatalogo(fic, ano, { vagasPorAno: 60 }, "Turma FIC de 160 h (Mulheres Mil)"));
  }
  return lista;
}

export function ComparadorAlternativas({
  campus,
  instituicao,
  base,
  catalogo,
  campusNoPiso,
}: {
  campus: string;
  instituicao: string;
  base: ContextoBase;
  catalogo: ItemCatalogo[];
  campusNoPiso: boolean;
}) {
  const [anoInicial, setAnoInicial] = useState(base.anoDoValor + 1);
  const [horizonte, setHorizonte] = useState(8);
  const [reajustePct, setReajustePct] = useState(0);
  const [alternativas, setAlternativas] = useState<Alternativa[]>(() => alternativasIniciais(catalogo, base, base.anoDoValor + 1));

  const ctx: ContextoAlternativas = useMemo(() => ({ ...base, reajusteAnual: reajustePct / 100 }), [base, reajustePct]);
  const anos = useMemo(() => eixoDeAnos(anoInicial, horizonte), [anoInicial, horizonte]);
  const resultados = useMemo(() => alternativas.map((a) => resultadoDaAlternativa(a, ctx, anos)), [alternativas, ctx, anos]);
  const { maisRende, maisRapida } = useMemo(() => melhores(resultados), [resultados]);
  const ranking = useMemo(() => [...resultados].sort((a, b) => b.acumulado - a.acumulado), [resultados]);
  const maiorAcumulado = Math.max(...resultados.map((r) => r.acumulado), 1);

  function trocar(id: string, nova: Alternativa) {
    setAlternativas((l) => l.map((a) => (a.id === id ? nova : a)));
  }
  function remover(id: string) {
    setAlternativas((l) => l.filter((a) => a.id !== id));
  }
  function adicionarCurso() {
    const ref = catalogo.find((c) => c.chave === "BACHARELADO|NÃO SE APLICA|ADMINISTRACAO|3000") ?? catalogo[0];
    if (ref) setAlternativas((l) => [...l, cursoDoCatalogo(ref, anoInicial)]);
  }
  function adicionarIndicador() {
    const indicador: IndicadorSimulavel = base.indicadores.rap ? "RAP" : "IAPL_TECNICO";
    const atual = valorAtualDoIndicador(indicador, base.indicadores) ?? 0;
    const proximo = proximoDegrau(indicador, atual);
    setAlternativas((l) => [
      ...l,
      { tipo: "INDICADOR", id: novoId(), rotulo: `Subir ${ROTULO_INDICADOR[indicador]}`, primeiroAno: anoInicial, indicador, novoValor: proximo ? proximo.valor + (indicador === "RAP" ? 0.01 : 0.001) : atual },
    ]);
  }
  function adicionarEvasao() {
    setAlternativas((l) => [...l, { tipo: "EVASAO", id: novoId(), rotulo: "Reduzir a evasão do câmpus", primeiroAno: anoInicial, reducaoPct: 20 }]);
  }
  function adicionarMatricula() {
    setAlternativas((l) => [...l, { tipo: "MATRICULA", id: novoId(), rotulo: "Ocupar mais vagas nos cursos que já existem", primeiroAno: anoInicial, crescimentoPct: 5 }]);
  }

  return (
    <div className="flex flex-col gap-6">
      {campusNoPiso && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>{campus}</strong> está travado no Piso Mínimo: o Funcionamento dele é o piso, não o calculado por matrícula. Curso novo, evasão e
          matrícula só mudam o que ele recebe se o calculado passar do piso. Os indicadores (RAP e IAPL) valem para a instituição toda e não dependem disso.
        </p>
      )}

      <section className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:grid-cols-3">
        <h2 className="col-span-full text-sm font-semibold text-neutral-900 dark:text-neutral-100">Para todas as alternativas</h2>
        <Numero rotulo="Primeiro ano da comparação" valor={anoInicial} passo={1} min={base.anoDoValor} max={base.anoDoValor + 10} onChange={(v) => setAnoInicial(Math.round(v))} ajuda="Começo do eixo de anos; cada alternativa tem o próprio primeiro ano" />
        <Numero rotulo="Anos a comparar" valor={horizonte} passo={1} min={3} max={15} onChange={(v) => setHorizonte(Math.round(v))} />
        <Numero rotulo="Reajuste do valor da matrícula por ano (%)" valor={reajustePct} passo={0.5} min={-10} max={30} onChange={setReajustePct} ajuda={`Hoje a matrícula vale ${reais.format(base.valorMatricula)} (ciclo ${base.anoDoValor}). Zero é o conservador.`} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Adicionar</span>
        <BotaoAdicionar onClick={adicionarCurso}>Curso novo</BotaoAdicionar>
        <BotaoAdicionar onClick={adicionarIndicador}>Subir um indicador (RAP, IAPL)</BotaoAdicionar>
        <BotaoAdicionar onClick={adicionarEvasao}>Reduzir a evasão</BotaoAdicionar>
        <BotaoAdicionar onClick={adicionarMatricula}>Ocupar mais vagas</BotaoAdicionar>
      </div>

      {alternativas.length === 0 ? (
        <p className="rounded-md border border-neutral-200 px-3 py-6 text-center text-sm text-neutral-500 dark:border-neutral-800">Adicione uma alternativa para comparar.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {alternativas.map((a) => (
            <CartaoAlternativa key={a.id} alt={a} ctx={ctx} catalogo={catalogo} instituicao={instituicao} campus={campus} onChange={(n) => trocar(a.id, n)} onRemover={() => remover(a.id)} />
          ))}
        </div>
      )}

      {resultados.length > 0 && (
        <>
          <Veredito maisRende={maisRende} maisRapida={maisRapida} anos={anos} />

          <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">O que cada alternativa rende, da que mais rende para a que menos rende</h2>
            <div className="tabela-rolavel">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3">Alternativa</th>
                    <th className="px-3 py-2 text-right">Começa em</th>
                    <th className="px-3 py-2 text-right">Alunos novos</th>
                    <th className="px-3 py-2 text-right">Ganho em {anos[anos.length - 1]}</th>
                    <th className="w-1/4 px-3 py-2">Acumulado em {horizonte} anos</th>
                    <th className="px-3 py-2 text-right">Por aluno novo, ao ano</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {ranking.map((r, i) => (
                    <tr key={r.id} className={r.id === maisRende?.id ? "bg-if-green/5" : ""}>
                      <td className="py-2 pr-3">
                        <span className="mr-1 text-xs text-neutral-400">{i + 1}.</span>
                        <span className="font-medium">{r.rotulo}</span>
                        {r.id === maisRende?.id && <Etiqueta cor="verde">rende mais</Etiqueta>}
                        {r.id === maisRapida?.id && r.id !== maisRende?.id && <Etiqueta cor="azul">começa antes</Etiqueta>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.anoDoPrimeiroGanho ?? "nunca"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.alunosNovos > 0 ? inteiro.format(r.alunosNovos) : "nenhum"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{reais.format(r.ganhoNoUltimoAno)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <div className="h-2 rounded-full bg-if-green" style={{ width: `${Math.max(0, Math.min(100, (r.acumulado / maiorAcumulado) * 100))}%` }} />
                          </div>
                          <span className="w-24 shrink-0 text-right text-xs tabular-nums">{reais.format(r.acumulado)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.ganhoPorAlunoNovo === null ? "sem aluno novo" : reais.format(r.ganhoPorAlunoNovo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ano a ano: o ganho de cada alternativa</h2>
            <div className="tabela-rolavel">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="py-2 pr-3">Ano</th>
                    {resultados.map((r) => (
                      <th key={r.id} className="px-3 py-2 text-right normal-case">
                        {r.rotulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {anos.map((ano, i) => {
                    const melhorDoAno = Math.max(...resultados.map((r) => r.ganhoPorAno[i] ?? 0));
                    return (
                      <tr key={ano}>
                        <td className="py-1.5 pr-3 tabular-nums">{ano}</td>
                        {resultados.map((r) => {
                          const g = r.ganhoPorAno[i] ?? 0;
                          return (
                            <td key={r.id} className={`px-3 py-1.5 text-right tabular-nums ${g > 0 && g === melhorDoAno ? "font-semibold text-if-green" : g === 0 ? "text-neutral-400" : ""}`}>
                              {g === 0 ? "-" : reais.format(g)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-1.5 pr-3">Soma</td>
                    {resultados.map((r) => (
                      <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                        {reais.format(r.acumulado)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-500">Em verde, o maior ganho de cada ano. Cursos novos crescem turma a turma até o regime; indicador, evasão e matrícula somam o mesmo valor todo ano a partir do primeiro ano deles.</p>
          </section>
        </>
      )}

      <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Como ler esta comparação</h2>
        <p>
          Tudo é medido na mesma régua: o <strong>ganho em reais por ano</strong> que a alternativa soma ao que {campus} já recebe. Curso novo: repasse das turmas, pela mesma regra de
          Matrícula Total da MDO. Indicador (RAP, IAPL): a diferença que a faixa nova faz no bloco, <strong>para a instituição {instituicao} inteira</strong>, não só para o câmpus. Evasão e
          ocupação de vagas: uma fração do que o câmpus perde ou recebe hoje.
        </p>
        <p>
          O que nenhuma alternativa mostra é o <strong>custo</strong> (professores, laboratório, sala, permanência) nem o <strong>esforço</strong> de conseguir o resultado. A coluna "alunos novos"
          dá uma ideia do esforço: um indicador ou a evasão rendem sem aluno novo; um curso exige encher turmas. O valor da matrícula dos anos futuros é uma hipótese, e a repartição do bloco de
          indicadores mexe com a rede toda, então os números de indicador são uma estimativa.
        </p>
        <p>
          <strong>Mulheres Mil e FIC:</strong> a simulação trata a turma como um FIC presencial comum, com o peso do catálogo de FIC e a carga horária de 160 h. Se a MDO contar essas matrículas de outro
          jeito (outra modalidade ou outro peso), o número muda: confirme antes de decidir.
        </p>
      </section>
    </div>
  );
}

function Veredito({ maisRende, maisRapida, anos }: { maisRende: ResultadoAlternativa | null; maisRapida: ResultadoAlternativa | null; anos: number[] }) {
  if (!maisRende) {
    return <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">Nenhuma das alternativas rende algo no período.</p>;
  }
  const periodo = `${anos[0]} a ${anos[anos.length - 1]}`;
  return (
    <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      No período de {periodo}, a que mais rende é <strong>{maisRende.rotulo}</strong>, com {reais.format(maisRende.acumulado)} acumulados.
      {maisRapida && maisRapida.id !== maisRende.id && (
        <> A que começa a render antes é <strong>{maisRapida.rotulo}</strong> (já em {maisRapida.anoDoPrimeiroGanho}), com {reais.format(maisRapida.acumulado)}.</>
      )}
    </p>
  );
}

function Etiqueta({ cor, children }: { cor: "verde" | "azul"; children: React.ReactNode }) {
  const classes = cor === "verde" ? "bg-if-green/15 text-if-green dark:text-green-400" : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${classes}`}>{children}</span>;
}

function BotaoAdicionar({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
      + {children}
    </button>
  );
}

const ROTULO_TIPO: Record<Alternativa["tipo"], string> = {
  CURSO: "Curso",
  INDICADOR: "Indicador",
  EVASAO: "Evasão",
  MATRICULA: "Vagas",
};

function CartaoAlternativa({
  alt,
  ctx,
  catalogo,
  instituicao,
  campus,
  onChange,
  onRemover,
}: {
  alt: Alternativa;
  ctx: ContextoAlternativas;
  catalogo: ItemCatalogo[];
  instituicao: string;
  campus: string;
  onChange: (a: Alternativa) => void;
  onRemover: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{ROTULO_TIPO[alt.tipo]}</span>
        <input
          value={alt.rotulo}
          onChange={(e) => onChange({ ...alt, rotulo: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-transparent px-2 py-1 text-sm font-semibold hover:border-neutral-300 dark:bg-transparent dark:hover:border-neutral-700"
          aria-label="Nome da alternativa"
        />
        <button type="button" onClick={onRemover} className="text-xs text-neutral-500 hover:text-if-red" aria-label="Remover alternativa">
          remover
        </button>
      </div>
      {alt.tipo === "CURSO" && <CorpoCurso alt={alt} catalogo={catalogo} onChange={onChange} />}
      {alt.tipo === "INDICADOR" && <CorpoIndicador alt={alt} ctx={ctx} instituicao={instituicao} onChange={onChange} />}
      {alt.tipo === "EVASAO" && <CorpoEvasao alt={alt} ctx={ctx} campus={campus} onChange={onChange} />}
      {alt.tipo === "MATRICULA" && <CorpoMatricula alt={alt} ctx={ctx} campus={campus} onChange={onChange} />}
    </section>
  );
}

function CorpoCurso({ alt, catalogo, onChange }: { alt: AlternativaCurso; catalogo: ItemCatalogo[]; onChange: (a: Alternativa) => void }) {
  const [filtro, setFiltro] = useState("");
  const normalizado = filtro.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  const opcoes = catalogo.filter((c) => !normalizado || c.rotulo.includes(normalizado) || c.tipoCurso.includes(normalizado)).slice(0, 80);
  const atual = catalogo.find((c) => c.chave === alt.referencia);
  const emMeses = alt.opcao.mesesDuracao !== undefined;
  const o = alt.opcao;

  function usar(ref: ItemCatalogo) {
    const p = ref.padroes;
    onChange({
      ...alt,
      referencia: ref.chave,
      peso: ref.peso,
      rotulo: `${ref.rotulo}, ${sufixoDuracao({ anosDuracao: p.anosDuracao, mesesDuracao: p.mesesDuracao })}`,
      opcao: { ...o, rotulo: ref.rotulo, anosDuracao: p.anosDuracao, mesesDuracao: p.mesesDuracao, chTotalCiclo: p.chTotal, chMatriz: p.teto, vagasPorAno: p.vagasPorAno },
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Curso de referência (dele vêm o peso e o teto de carga horária)</span>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="filtrar, ex.: administração, FIC, integrado" className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
        <select
          value={alt.referencia ?? ""}
          onChange={(e) => {
            const ref = catalogo.find((c) => c.chave === e.target.value);
            if (ref) usar(ref);
          }}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {atual && !opcoes.some((c) => c.chave === atual.chave) && <option value={atual.chave}>{atual.rotulo}</option>}
          {opcoes.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.tipoCurso}: {c.rotulo}, peso {c.peso}, CH mín. {c.chMinimaMec} h
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Numero rotulo="Primeiro ano de entrada" valor={alt.primeiroAno} passo={1} min={2020} max={2060} onChange={(v) => onChange({ ...alt, primeiroAno: Math.round(v) })} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Duração</span>
          <div className="flex gap-1">
            <input
              type="number"
              min={1}
              max={emMeses ? 36 : 8}
              value={emMeses ? o.mesesDuracao : o.anosDuracao}
              onChange={(e) => {
                const v = Math.max(1, Math.round(Number(e.target.value)));
                onChange({ ...alt, opcao: emMeses ? { ...o, mesesDuracao: v, anosDuracao: Math.max(1, Math.ceil(v / 12)) } : { ...o, anosDuracao: v } });
              }}
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
            />
            <select
              value={emMeses ? "meses" : "anos"}
              onChange={(e) =>
                onChange({
                  ...alt,
                  opcao: e.target.value === "meses" ? { ...o, mesesDuracao: o.anosDuracao * 12, anosDuracao: o.anosDuracao } : { ...o, mesesDuracao: undefined, anosDuracao: Math.max(1, Math.ceil((o.mesesDuracao ?? 12) / 12)) },
                })
              }
              className="rounded-md border border-neutral-300 px-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="anos">anos</option>
              <option value="meses">meses</option>
            </select>
          </div>
        </label>
        <Numero rotulo="CH total da turma (h)" valor={o.chTotalCiclo} passo={20} min={20} max={6000} onChange={(v) => onChange({ ...alt, opcao: { ...o, chTotalCiclo: v } })} ajuda={o.chTotalCiclo > o.chMatriz ? `${inteiro.format(o.chTotalCiclo - o.chMatriz)} h acima do teto não rendem` : undefined} />
        <Numero rotulo="Vagas por ano" valor={o.vagasPorAno} passo={5} min={1} max={800} onChange={(v) => onChange({ ...alt, opcao: { ...o, vagasPorAno: v } })} />
        <Numero rotulo="Evasão por ano (%)" valor={Math.round(o.evasaoAnual * 100)} passo={1} min={0} max={60} onChange={(v) => onChange({ ...alt, opcao: { ...o, evasaoAnual: Math.min(0.9, Math.max(0, v / 100)) } })} />
        <Numero rotulo="Peso do curso" valor={alt.peso} passo={0.25} min={0.5} max={3.75} onChange={(v) => onChange({ ...alt, peso: v })} />
        <Numero rotulo="Teto de CH da matriz (h)" valor={o.chMatriz} passo={100} min={20} max={6000} onChange={(v) => onChange({ ...alt, opcao: { ...o, chMatriz: v } })} />
      </div>
    </>
  );
}

function CorpoIndicador({ alt, ctx, instituicao, onChange }: { alt: AlternativaIndicador; ctx: ContextoAlternativas; instituicao: string; onChange: (a: Alternativa) => void }) {
  const atual = valorAtualDoIndicador(alt.indicador, ctx.indicadores);
  const ehRap = alt.indicador === "RAP";
  const fator = ehRap ? 1 : 100;
  const proximo = atual === null ? null : proximoDegrau(alt.indicador, atual);
  const disponiveis = (Object.keys(ROTULO_INDICADOR) as IndicadorSimulavel[]).filter((i) => valorAtualDoIndicador(i, ctx.indicadores) !== null);
  if (disponiveis.length === 0 || atual === null) {
    return <p className="text-sm text-neutral-500">{instituicao} não tem RAP nem IAPL carregados neste ciclo, então não há como simular indicadores.</p>;
  }
  const formatar = (v: number) => (ehRap ? decimal.format(v) : `${decimal.format(v * 100)}%`);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm col-span-2">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Indicador</span>
          <select
            value={alt.indicador}
            onChange={(e) => {
              const ind = e.target.value as IndicadorSimulavel;
              const a = valorAtualDoIndicador(ind, ctx.indicadores) ?? 0;
              const p = proximoDegrau(ind, a);
              onChange({ ...alt, indicador: ind, rotulo: `Subir ${ROTULO_INDICADOR[ind]}`, novoValor: p ? p.valor + (ind === "RAP" ? 0.01 : 0.001) : a });
            }}
            className="rounded-md border border-neutral-300 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {disponiveis.map((i) => (
              <option key={i} value={i}>
                {ROTULO_INDICADOR[i]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Hoje</span>
          <span className="rounded-md bg-neutral-50 px-2 py-1.5 tabular-nums dark:bg-neutral-900">{formatar(atual)}</span>
        </div>
        <Numero rotulo={ehRap ? "Passaria a" : "Passaria a (%)"} valor={Math.round(alt.novoValor * fator * 1000) / 1000} passo={ehRap ? 0.1 : 0.5} min={0} max={ehRap ? 60 : 100} onChange={(v) => onChange({ ...alt, novoValor: v / fator })} />
        <Numero rotulo="A partir de" valor={alt.primeiroAno} passo={1} min={2020} max={2060} onChange={(v) => onChange({ ...alt, primeiroAno: Math.round(v) })} />
      </div>
      <p className="text-xs text-neutral-500">
        {ehRap && <>RAP hoje na faixa {ROTULO_FAIXA_RAP[faixaRap(atual)]}. </>}
        {proximo ? (
          <>
            Próximo degrau: {formatar(proximo.valor)} (peso {proximo.peso}), faltam {ehRap ? decimal.format(proximo.falta) : `${decimal.format(proximo.falta * 100)} pontos percentuais`}.
          </>
        ) : (
          <>Já está no último degrau.</>
        )}{" "}
        O ganho vale para {instituicao} inteira: a fatia dela no bloco muda, e as outras instituições dividem o resto.
      </p>
    </>
  );
}

function CorpoEvasao({ alt, ctx, campus, onChange }: { alt: AlternativaEvasao; ctx: ContextoAlternativas; campus: string; onChange: (a: Alternativa) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo="Reduzir a perda por evasão em (%)" valor={alt.reducaoPct} passo={5} min={0} max={100} onChange={(v) => onChange({ ...alt, reducaoPct: v })} />
        <Numero rotulo="A partir de" valor={alt.primeiroAno} passo={1} min={2020} max={2060} onChange={(v) => onChange({ ...alt, primeiroAno: Math.round(v) })} />
      </div>
      <p className="text-xs text-neutral-500">
        {campus} perde hoje {reais.format(ctx.perdaCampus)} por ano com a evasão. Recuperar {alt.reducaoPct}% disso é {reais.format(ctx.perdaCampus * (alt.reducaoPct / 100))} por ano.
      </p>
    </>
  );
}

function CorpoMatricula({ alt, ctx, campus, onChange }: { alt: AlternativaMatricula; ctx: ContextoAlternativas; campus: string; onChange: (a: Alternativa) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo="Matrícula cresce (%)" valor={alt.crescimentoPct} passo={1} min={0} max={100} onChange={(v) => onChange({ ...alt, crescimentoPct: v })} />
        <Numero rotulo="A partir de" valor={alt.primeiroAno} passo={1} min={2020} max={2060} onChange={(v) => onChange({ ...alt, primeiroAno: Math.round(v) })} />
      </div>
      <p className="text-xs text-neutral-500">
        {campus} tem {inteiro.format(ctx.alunosCampus)} alunos e recebe {reais.format(ctx.orcamentoCampusHoje)} hoje. Crescer {alt.crescimentoPct}% é cerca de {inteiro.format(ctx.alunosCampus * (alt.crescimentoPct / 100))} alunos
        a mais, nos cursos que já existem (proporcional ao que cada um rende).
      </p>
    </>
  );
}

function Numero({ rotulo, valor, passo, min, max, onChange, ajuda }: { rotulo: string; valor: number; passo: number; min: number; max: number; onChange: (v: number) => void; ajuda?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{rotulo}</span>
      <input
        type="number"
        value={valor}
        step={passo}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="rounded-md border border-neutral-300 px-2 py-1.5 tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
      />
      {ajuda && <span className="text-xs text-neutral-500">{ajuda}</span>}
    </label>
  );
}
