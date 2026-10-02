"use client";

import { useMemo, useState } from "react";
import { simularOpcaoCurso, type OpcaoCurso } from "@/lib/mdo/simulacaoCurso";

export interface CursoNovoBase {
  /** Nome do curso de referência, de onde vieram o peso e a CH mínima. */
  rotulo: string;
  /** Peso efetivo (o que a MDO aplica, já com o bônus de agropecuária, se houver). */
  peso: number;
  /** Teto de CH da matriz para este tipo de curso e oferta (3.200 h no integrado de CH mínima 1.200 h). */
  chMatriz: number;
  /** CH mínima do MEC, só para mostrar. */
  chMinimaMec: number;
  /** Valor de uma matrícula no ciclo base, tirado dos ciclos do câmpus. */
  valorMatricula: number;
  /** Ciclo de onde vem o valor da matrícula. */
  anoDoValor: number;
  /** O que o câmpus recebe hoje em Funcionamento (soma dos ciclos do ciclo base), para dar escala. */
  orcamentoCampusHoje: number;
  /** Matrícula total equivalente da rede, base da diluição do valor da matrícula. */
  matriculasRede: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const reais2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function SimuladorNovoCurso({ campus, base, campusNoPiso }: { campus: string; base: CursoNovoBase; campusNoPiso: boolean }) {
  const [nome, setNome] = useState(base.rotulo);
  const [primeiroAno, setPrimeiroAno] = useState(base.anoDoValor + 1);
  const [duracao, setDuracao] = useState(4);
  const [chTotal, setChTotal] = useState(4200);
  const [vagas, setVagas] = useState(40);
  const [evasao, setEvasao] = useState(0);
  const [peso, setPeso] = useState(base.peso);
  const [teto, setTeto] = useState(base.chMatriz);
  const [valorMatricula, setValorMatricula] = useState(Math.round(base.valorMatricula * 100) / 100);
  const [reajuste, setReajuste] = useState(0);
  const [horizonte, setHorizonte] = useState(8);
  const [diluir, setDiluir] = useState(false);

  const opcao: OpcaoCurso = { rotulo: nome, anosDuracao: duracao, chTotalCiclo: chTotal, chMatriz: teto, vagasPorAno: vagas, evasaoAnual: evasao };
  const parametros = useMemo(
    () => ({
      peso,
      agropecuaria: false,
      valorMatricula,
      anoInicial: primeiroAno,
      horizonteAnos: horizonte,
      reajusteAnual: reajuste,
      anoDoValor: base.anoDoValor,
      diluicao: diluir ? { matriculasEquivalentesRede: base.matriculasRede } : undefined,
    }),
    [peso, valorMatricula, primeiroAno, horizonte, reajuste, base.anoDoValor, diluir, base.matriculasRede],
  );
  const r = useMemo(() => simularOpcaoCurso(opcao, parametros), [nome, duracao, chTotal, teto, vagas, evasao, parametros]); // eslint-disable-line react-hooks/exhaustive-deps
  // O mesmo curso com a CH limitada ao teto: se der igual, a CH acima do teto não rende nada.
  const noTeto = useMemo(
    () => simularOpcaoCurso({ ...opcao, chTotalCiclo: Math.min(chTotal, teto) }, parametros),
    [nome, duracao, chTotal, teto, vagas, evasao, parametros], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const maxValor = Math.max(...r.linhas.map((l) => l.valor), 1);
  const anoRegime = primeiroAno + duracao - 1;
  const linhaRegime = r.linhas.find((l) => l.ano === anoRegime);

  return (
    <div className="flex flex-col gap-6">
      {campusNoPiso && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>{campus}</strong> está travado no Piso Mínimo: o Funcionamento dele é o piso, não o calculado por matrícula. Um curso
          novo só muda o que ele recebe se o calculado passar do piso.
        </p>
      )}

      <section className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="col-span-full text-sm font-semibold text-neutral-900 dark:text-neutral-100">O curso novo em {campus}</h2>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Nome do curso</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="rounded-md border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900" />
        </label>
        <Numero rotulo="Primeiro ano de entrada" valor={primeiroAno} passo={1} min={base.anoDoValor} max={base.anoDoValor + 10} onChange={(v) => setPrimeiroAno(Math.round(v))} ajuda="A primeira turma entra em março" />
        <Numero rotulo="Duração (anos)" valor={duracao} passo={1} min={1} max={6} onChange={(v) => setDuracao(Math.max(1, Math.round(v)))} />
        <Numero rotulo="CH total da turma (h)" valor={chTotal} passo={50} min={100} max={6000} onChange={setChTotal} ajuda={chTotal > teto ? `${inteiro.format(chTotal - teto)} h acima do teto da matriz não rendem` : undefined} />
        <Numero rotulo="Vagas por ano" valor={vagas} passo={5} min={1} max={400} onChange={setVagas} />
        <Numero rotulo="Evasão por ano (%)" valor={Math.round(evasao * 100)} passo={1} min={0} max={60} onChange={(v) => setEvasao(Math.min(0.9, Math.max(0, v / 100)))} />
        <Numero rotulo="Anos a simular" valor={horizonte} passo={1} min={duracao} max={15} onChange={(v) => setHorizonte(Math.round(v))} />
      </section>

      <section className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="col-span-full text-sm font-semibold text-neutral-900 dark:text-neutral-100">Regras que valem para o curso (já preenchidas, pode mudar)</h2>
        <Numero rotulo="Peso do curso" valor={peso} passo={0.25} min={1} max={3.75} onChange={setPeso} ajuda={`Peso efetivo de ${base.rotulo}, da tabela de pesos`} />
        <Numero rotulo="Teto de CH da matriz (h)" valor={teto} passo={100} min={100} max={6000} onChange={setTeto} ajuda={`Curso com CH mínima do MEC de ${inteiro.format(base.chMinimaMec)} h`} />
        <Numero rotulo={`Valor de uma matrícula (R$, ciclo ${base.anoDoValor})`} valor={valorMatricula} passo={10} min={1} max={5000} onChange={setValorMatricula} ajuda="Vem dos ciclos deste câmpus" />
        <Numero rotulo="Reajuste do valor por ano (%)" valor={Math.round(reajuste * 1000) / 10} passo={0.5} min={-10} max={30} onChange={(v) => setReajuste(v / 100)} ajuda="Zero é o conservador: o valor real só se conhece quando a MDO fecha o ciclo" />
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 sm:col-span-2">
          <input type="checkbox" checked={diluir} onChange={(e) => setDiluir(e.target.checked)} />
          Considerar que mais matrícula na rede dilui o valor de cada matrícula
        </label>
      </section>

      {chTotal > teto && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>A carga horária acima do teto não rende.</strong> A MDO conta no máximo {inteiro.format(teto)} h por aluno neste curso, e a turma
          tem {inteiro.format(chTotal)} h. Com {inteiro.format(teto)} h o repasse acumulado em {horizonte} anos seria {reais.format(noTeto.valorAcumuladoHorizonte)},
          {Math.abs(noTeto.valorAcumuladoHorizonte - r.valorAcumuladoHorizonte) < 1
            ? " exatamente o mesmo: as horas a mais não pagam nada."
            : ` contra ${reais.format(r.valorAcumuladoHorizonte)} com ${inteiro.format(chTotal)} h.`}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo={`Repasse por ano em regime (${anoRegime})`} valor={linhaRegime ? reais.format(linhaRegime.valor) : "-"} nota={`${duracao} turmas em andamento, ano completo`} />
        <Cartao titulo="Um aluno por ano, em regime" valor={reais2.format(r.regime.valorPorAlunoAno)} nota={`${inteiro.format(r.regime.alunosAtivos)} alunos em regime`} />
        <Cartao titulo={`Acumulado em ${horizonte} anos`} valor={reais.format(r.valorAcumuladoHorizonte)} nota={`de ${primeiroAno} a ${primeiroAno + horizonte - 1}`} />
        <Cartao
          titulo="Em relação ao câmpus hoje"
          valor={base.orcamentoCampusHoje > 0 && linhaRegime ? `+${percentual.format(linhaRegime.valor / base.orcamentoCampusHoje)}` : "-"}
          nota={`${reais.format(base.orcamentoCampusHoje)} de Funcionamento no ciclo ${base.anoDoValor}`}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ano a ano</h2>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Ano</th>
                <th className="px-3 py-2 text-right">Turmas</th>
                <th className="px-3 py-2 text-right">Alunos</th>
                <th className="px-3 py-2 text-right">Matrícula Total</th>
                <th className="px-3 py-2 text-right">Valor da matrícula</th>
                <th className="w-1/3 px-3 py-2">Repasse do ano</th>
                <th className="px-3 py-2 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {r.linhas.map((l) => (
                <tr key={l.ano} className={l.ano === anoRegime ? "bg-if-green/5 font-medium" : ""}>
                  <td className="py-1.5 pr-3 tabular-nums">{l.ano}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.turmasAtivas}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{inteiro.format(l.alunosAtivos)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{decimal.format(l.matriculaTotal)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{reais2.format(l.valorMatricula)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div className="h-2 rounded-full bg-if-green" style={{ width: `${Math.max(0, Math.min(100, (l.valor / maxValor) * 100))}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-400">{reais.format(l.valor)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(l.valorAcumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          A linha em verde é o primeiro ano em que as {duracao} turmas estão em andamento (regime). Antes dele o repasse cresce a cada turma nova;
          depois, só muda se mudarem as vagas, a evasão ou o valor da matrícula. A coluna Turmas pode mostrar uma a mais por pouco tempo: a turma que
          termina em fevereiro ainda conta nos meses que sobram do ano.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Como esta conta é feita</h2>
        <p>
          Cada turma que entra em março vira um ciclo, e a Matrícula Total dele sai da mesma regra que a MDO aplica (a que reproduz ao centavo os 1.352
          ciclos do IFSul): alunos × peso × (CH ÷ 800) × dias do ano dentro do ciclo ÷ dias do ciclo, com a CH limitada ao teto da matriz. Multiplicada
          pelo valor de uma matrícula, dá o repasse do ano. As turmas se somam até o curso chegar ao regime.
        </p>
        <p>
          <strong>É uma estimativa.</strong> O valor da matrícula de {primeiroAno} em diante é uma hipótese (o do ciclo {base.anoDoValor}, mais o reajuste que você
          informar), porque ele muda a cada ciclo conforme o orçamento e as matrículas da rede. O repasse mede só o que o curso rende: custo de
          professor, laboratório, sala e permanência não entra.
        </p>
      </section>
    </div>
  );
}

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <span className="text-xs text-neutral-500">{titulo}</span>
      <span className="text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</span>
      <span className="text-xs text-neutral-500">{nota}</span>
    </div>
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
