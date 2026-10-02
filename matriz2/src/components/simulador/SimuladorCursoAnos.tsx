"use client";

import { useMemo, useState } from "react";
import { anoDaVirada, simularOpcaoCurso, type OpcaoCurso, type ResultadoOpcaoCurso } from "@/lib/mdo/simulacaoCurso";

export interface CursoBase {
  rotulo: string;
  peso: number;
  agropecuaria: boolean;
  chMatriz: number;
  valorMatricula: number;
  alunosHoje: number;
  valorHoje: number;
  ciclosHoje: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const COR_A = "bg-if-green";
const COR_B = "bg-sky-600";

function pctDiferenca(a: number, b: number): string {
  if (b === 0) return "-";
  const p = (a / b - 1) * 100;
  return `${p >= 0 ? "+" : ""}${decimal.format(p)}%`;
}

export function SimuladorCursoAnos({
  campus,
  ano,
  base,
  campusNoPiso,
  matriculasRede,
}: {
  campus: string;
  ano: number;
  base: CursoBase;
  campusNoPiso: boolean;
  /** Matrícula total equivalente da rede, base da diluição do valor da matrícula. */
  matriculasRede: number;
}) {
  const [peso, setPeso] = useState(base.peso);
  const [agro, setAgro] = useState(base.agropecuaria);
  const [valorMatricula, setValorMatricula] = useState(Math.round(base.valorMatricula * 100) / 100);
  const [chMatriz, setChMatriz] = useState(base.chMatriz);
  const [horizonte, setHorizonte] = useState(8);
  const [diluir, setDiluir] = useState(false);
  const [a, setA] = useState<OpcaoCurso>({
    rotulo: "Opção A",
    anosDuracao: 3,
    chTotalCiclo: Math.min(3000, base.chMatriz),
    chMatriz: base.chMatriz,
    vagasPorAno: 40,
    evasaoAnual: 0,
  });
  const [b, setB] = useState<OpcaoCurso>({
    rotulo: "Opção B",
    anosDuracao: 4,
    chTotalCiclo: base.chMatriz,
    chMatriz: base.chMatriz,
    vagasPorAno: 40,
    evasaoAnual: 0,
  });

  const parametros = useMemo(
    () => ({
      peso,
      agropecuaria: agro,
      valorMatricula,
      anoInicial: ano,
      horizonteAnos: horizonte,
      diluicao: diluir ? { matriculasEquivalentesRede: matriculasRede } : undefined,
    }),
    [peso, agro, valorMatricula, ano, horizonte, diluir, matriculasRede],
  );
  const ra = useMemo(() => simularOpcaoCurso({ ...a, chMatriz }, parametros), [a, chMatriz, parametros]);
  const rb = useMemo(() => simularOpcaoCurso({ ...b, chMatriz }, parametros), [b, chMatriz, parametros]);
  const virada = anoDaVirada(ra, rb) ?? anoDaVirada(rb, ra);
  const quemViraPrimeiro = anoDaVirada(ra, rb) !== null ? ra : rb;

  const maxAno = Math.max(...ra.linhas.map((l) => l.valor), ...rb.linhas.map((l) => l.valor), 1);

  return (
    <div className="flex flex-col gap-6">
      {campusNoPiso && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>{campus}</strong> está travado no Piso Mínimo: o Funcionamento dele é o piso, não o calculado
          por matrícula. Um curso a mais só muda o que ele recebe se o calculado passar do piso.
        </p>
      )}

      <section className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="col-span-full text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          O curso (vale para as duas opções), partindo de {base.rotulo}
        </h2>
        <Numero rotulo="Peso do curso" valor={peso} passo={0.25} min={1} max={3.75} onChange={setPeso} ajuda="1,0 a 2,5 pelos laboratórios do CNCT; 3,75 na pós stricto sensu" />
        <Numero rotulo="Teto de CH da matriz (h)" valor={chMatriz} passo={100} min={100} max={5000} onChange={setChMatriz} ajuda="No integrado: 3.000, 3.100 ou 3.200 h conforme o eixo" />
        <Numero rotulo="Valor de uma matrícula (R$)" valor={valorMatricula} passo={10} min={1} max={5000} onChange={setValorMatricula} ajuda={`Vem dos ciclos de ${ano} deste câmpus`} />
        <Numero rotulo="Anos a simular" valor={horizonte} passo={1} min={4} max={15} onChange={(v) => setHorizonte(Math.round(v))} ajuda="A primeira turma entra em março do primeiro ano" />
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" checked={agro} onChange={(e) => setAgro(e.target.checked)} />
          Curso de agropecuária (+50%)
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 sm:col-span-2">
          <input type="checkbox" checked={diluir} onChange={(e) => setDiluir(e.target.checked)} />
          Considerar que mais matrícula na rede dilui o valor de cada matrícula
        </label>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoOpcao op={a} onChange={setA} cor={COR_A} chMatriz={chMatriz} />
        <CartaoOpcao op={b} onChange={setB} cor={COR_B} chMatriz={chMatriz} />
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">O que cada opção rende</h2>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3"></th>
                <th className="px-3 py-2 text-right">
                  <Marca cor={COR_A} /> {a.anosDuracao} anos, {inteiro.format(a.chTotalCiclo)} h
                </th>
                <th className="px-3 py-2 text-right">
                  <Marca cor={COR_B} /> {b.anosDuracao} anos, {inteiro.format(b.chTotalCiclo)} h
                </th>
                <th className="px-3 py-2 text-right">A em relação a B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              <Linha rotulo="CH que a MDO conta por aluno" a={`${inteiro.format(ra.chEfetiva)} h`} b={`${inteiro.format(rb.chEfetiva)} h`} dif={pctDiferenca(ra.chEfetiva, rb.chEfetiva)} nota={ra.chDesperdicada > 0 || rb.chDesperdicada > 0 ? `Acima do teto não rende: ${inteiro.format(ra.chDesperdicada)} h (A), ${inteiro.format(rb.chDesperdicada)} h (B).` : undefined} />
              <Linha rotulo="Por ingressante, do ingresso à formatura" a={reais.format(ra.valorPorIngressante)} b={reais.format(rb.valorPorIngressante)} dif={pctDiferenca(ra.valorPorIngressante, rb.valorPorIngressante)} destaque />
              <Linha rotulo="Alunos matriculados em regime" a={inteiro.format(ra.regime.alunosAtivos)} b={inteiro.format(rb.regime.alunosAtivos)} dif={pctDiferenca(ra.regime.alunosAtivos, rb.regime.alunosAtivos)} />
              <Linha rotulo="Repasse por ano, em regime" a={reais.format(ra.regime.valor)} b={reais.format(rb.regime.valor)} dif={pctDiferenca(ra.regime.valor, rb.regime.valor)} destaque />
              <Linha rotulo="Valor de UM aluno por ano, em regime" a={reais2.format(ra.regime.valorPorAlunoAno)} b={reais2.format(rb.regime.valorPorAlunoAno)} dif={pctDiferenca(ra.regime.valorPorAlunoAno, rb.regime.valorPorAlunoAno)} destaque />
              <Linha rotulo={`Acumulado em ${horizonte} anos`} a={reais.format(ra.valorAcumuladoHorizonte)} b={reais.format(rb.valorAcumuladoHorizonte)} dif={pctDiferenca(ra.valorAcumuladoHorizonte, rb.valorAcumuladoHorizonte)} destaque />
            </tbody>
          </table>
        </div>
        <Veredito ra={ra} rb={rb} virada={virada} quemVira={quemViraPrimeiro === ra ? "A" : "B"} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ano a ano</h2>
        <div className="flex gap-4 text-xs text-neutral-600 dark:text-neutral-400">
          <span><Marca cor={COR_A} /> A ({a.anosDuracao} anos)</span>
          <span><Marca cor={COR_B} /> B ({b.anosDuracao} anos)</span>
        </div>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Ano</th>
                <th className="px-3 py-2 text-right">Alunos A</th>
                <th className="px-3 py-2 text-right">Alunos B</th>
                <th className="w-1/2 px-3 py-2">Repasse do ano</th>
                <th className="px-3 py-2 text-right">Acumulado A</th>
                <th className="px-3 py-2 text-right">Acumulado B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {ra.linhas.map((la, i) => {
                const lb = rb.linhas[i]!;
                return (
                  <tr key={la.ano}>
                    <td className="py-1.5 pr-3 tabular-nums">{la.ano}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(la.alunosAtivos)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(lb.alunosAtivos)}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-col gap-0.5">
                        <Barra cor={COR_A} pct={(la.valor / maxAno) * 100} texto={reais.format(la.valor)} />
                        <Barra cor={COR_B} pct={(lb.valor / maxAno) * 100} texto={reais.format(lb.valor)} />
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(la.valorAcumulado)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(lb.valorAcumulado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Como esta conta é feita</h2>
        <p>
          Cada turma vira um ciclo, e a Matrícula Total dele sai da mesma regra que a MDO aplica (a mesma que
          reproduz ao centavo os 1.352 ciclos do IFSul): alunos × peso × (CH ÷ 800) × dias do ano dentro do
          ciclo ÷ dias do ciclo. Multiplicada pelo valor de uma matrícula, dá o repasse.
        </p>
        <p>
          O que a regra mostra: a MDO paga pela <strong>carga horária total</strong> (até o teto da matriz), não
          pelo número de anos. Com a mesma CH, uma turma de 3 anos e uma de 4 rendem o mesmo por ingressante
          ao longo do curso; a de 3 anos rende mais por aluno a cada ano e chega antes ao regime. O curso de 4
          anos só compensa se a CH dele for maior, e isso para no teto. Já o custo de manter alunos por mais
          um ano (salas, professores, permanência) não entra nesta conta, só o repasse.
        </p>
        <p>
          Base de {base.rotulo} em {campus}, {ano}: {inteiro.format(base.ciclosHoje)} ciclo(s), {inteiro.format(base.alunosHoje)} alunos,{" "}
          {reais.format(base.valorHoje)} hoje.
        </p>
      </section>
    </div>
  );
}

function Veredito({ ra, rb, virada, quemVira }: { ra: ResultadoOpcaoCurso; rb: ResultadoOpcaoCurso; virada: number | null; quemVira: "A" | "B" }) {
  const porIngressante = ra.valorPorIngressante - rb.valorPorIngressante;
  const acumulado = ra.valorAcumuladoHorizonte - rb.valorAcumuladoHorizonte;
  const melhorIng = Math.abs(porIngressante) < 1 ? "empatam" : porIngressante > 0 ? "A" : "B";
  return (
    <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      {melhorIng === "empatam"
        ? "Por ingressante, as duas opções rendem o mesmo. "
        : `Por ingressante, a opção ${melhorIng} rende ${reais.format(Math.abs(porIngressante))} a mais. `}
      {Math.abs(acumulado) < 1
        ? "No horizonte simulado o acumulado é igual."
        : `No horizonte simulado, a opção ${acumulado > 0 ? "A" : "B"} acumula ${reais.format(Math.abs(acumulado))} a mais${virada ? `, passando a outra em ${virada} (opção ${quemVira})` : ""}.`}
    </p>
  );
}

function Marca({ cor }: { cor: string }) {
  return <span className={`mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle ${cor}`} aria-hidden />;
}

function Barra({ cor, pct, texto }: { cor: string; pct: number; texto: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-2 rounded-full ${cor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-400">{texto}</span>
    </div>
  );
}

function Linha({ rotulo, a, b, dif, destaque, nota }: { rotulo: string; a: string; b: string; dif: string; destaque?: boolean; nota?: string }) {
  return (
    <tr>
      <td className="py-2 pr-3 text-neutral-700 dark:text-neutral-300">
        {rotulo}
        {nota && <div className="text-xs text-neutral-500">{nota}</div>}
      </td>
      <td className={`px-3 py-2 text-right tabular-nums ${destaque ? "font-semibold" : ""}`}>{a}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${destaque ? "font-semibold" : ""}`}>{b}</td>
      <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{dif}</td>
    </tr>
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
        className="rounded-md border border-neutral-300 px-3 py-1.5 tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
      />
      {ajuda && <span className="text-xs text-neutral-500">{ajuda}</span>}
    </label>
  );
}

function CartaoOpcao({ op, onChange, cor, chMatriz }: { op: OpcaoCurso; onChange: (o: OpcaoCurso) => void; cor: string; chMatriz: number }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <Marca cor={cor} /> {op.rotulo}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo="Duração (anos)" valor={op.anosDuracao} passo={1} min={1} max={6} onChange={(v) => onChange({ ...op, anosDuracao: Math.max(1, Math.round(v)) })} />
        <Numero rotulo="CH total da turma (h)" valor={op.chTotalCiclo} passo={50} min={100} max={6000} onChange={(v) => onChange({ ...op, chTotalCiclo: v })} ajuda={op.chTotalCiclo > chMatriz ? `${inteiro.format(op.chTotalCiclo - chMatriz)} h acima do teto não rendem` : undefined} />
        <Numero rotulo="Vagas por ano" valor={op.vagasPorAno} passo={5} min={1} max={400} onChange={(v) => onChange({ ...op, vagasPorAno: v })} />
        <Numero rotulo="Evasão por ano (%)" valor={Math.round(op.evasaoAnual * 100)} passo={1} min={0} max={60} onChange={(v) => onChange({ ...op, evasaoAnual: Math.min(0.9, Math.max(0, v / 100)) })} />
      </div>
    </section>
  );
}
