"use client";

import { useMemo, useState } from "react";
import { aplicarCampos, comoBooleano, comoNumero, comoObjeto, comoTexto, useConfiguracaoSalvavel } from "@/components/configuracoes/ConfiguracoesSalvas";
import { anoDaVirada, exemploDoPrimeiroAno, exemploEmRegime, simularOpcaoCurso, valorMatriculaNoAno, type OpcaoCurso, type ParametrosSimulacaoCurso, type ResultadoOpcaoCurso } from "@/lib/mdo/simulacaoCurso";
import type { DecomposicaoMatricula } from "@/lib/mdo/matriculaTotal";
import { ehCampusDestaque } from "@/lib/destaque";
import { VAGAS_POR_ANO_PADRAO } from "@/lib/mdo/padroesCurso";
import { MarcadorDiluicao } from "./MarcadorDiluicao";
import { calcularRotina, ROTINA_PADRAO, type RotinaCalculada, type RotinaDoCampus } from "@/lib/mdo/rotinaCurso";

export interface CursoBase {
  rotulo: string;
  peso: number;
  agropecuaria: boolean;
  chMatriz: number;
  valorMatricula: number;
  alunosHoje: number;
  valorHoje: number;
  ciclosHoje: number;
  /** A carga horária que o curso tem de fato no câmpus (a mais frequente nos ciclos), quando os dados trazem. */
  chCurso: number | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
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
    vagasPorAno: VAGAS_POR_ANO_PADRAO,
    evasaoAnual: 0,
  });
  const [b, setB] = useState<OpcaoCurso>({
    rotulo: "Opção B",
    anosDuracao: 4,
    chTotalCiclo: base.chMatriz,
    chMatriz: base.chMatriz,
    vagasPorAno: VAGAS_POR_ANO_PADRAO,
    evasaoAnual: 0,
  });

  // A carga horária real de cada opção (a do PPC, que pode passar do mínimo que a matriz conta) e a rotina do câmpus.
  const [chRealA, setChRealA] = useState(base.chCurso ?? Math.min(3000, base.chMatriz));
  const [chRealB, setChRealB] = useState(base.chCurso ?? base.chMatriz);
  // Venâncio Aires conta os 15 minutos de intervalo como carga horária; nos outros câmpus a opção começa desmarcada.
  const [rotina, setRotina] = useState<RotinaDoCampus>({ ...ROTINA_PADRAO, contarIntervalo: ehCampusDestaque(campus) });

  useConfiguracaoSalvavel({
    chave: `simulador/curso:${campus}:${ano}:${base.rotulo}`,
    rotulo: "esta simulação",
    capturar: () => ({ peso, agro, valorMatricula, chMatriz, horizonte, diluir, a, b, chRealA, chRealB, rotina }),
    aplicar: (d) =>
      aplicarCampos(d, {
        peso: comoNumero(setPeso),
        agro: comoBooleano(setAgro),
        valorMatricula: comoNumero(setValorMatricula),
        chMatriz: comoNumero(setChMatriz),
        horizonte: comoNumero(setHorizonte),
        diluir: comoBooleano(setDiluir),
        a: comoObjeto<OpcaoCurso>(setA),
        b: comoObjeto<OpcaoCurso>(setB),
        chRealA: comoNumero(setChRealA),
        chRealB: comoNumero(setChRealB),
        rotina: comoObjeto<RotinaDoCampus>((r) => setRotina({ ...ROTINA_PADRAO, ...r })),
      }),
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
        <MarcadorDiluicao marcado={diluir} onChange={setDiluir} matriculasRede={matriculasRede} matriculaDoCurso={Math.max(ra.regime.matriculaTotal, rb.regime.matriculaTotal)} valorMatricula={valorMatricula} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoOpcao op={a} onChange={setA} cor={COR_A} chMatriz={chMatriz} chReal={chRealA} onChReal={setChRealA} />
        <CartaoOpcao op={b} onChange={setB} cor={COR_B} chMatriz={chMatriz} chReal={chRealB} onChReal={setChRealB} />
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
              <Linha rotulo="Valor de UM aluno por ano, em regime" a={reais2.format(ra.regime.valorPorAlunoAno)} b={reais2.format(rb.regime.valorPorAlunoAno)} dif={pctDiferenca(ra.regime.valorPorAlunoAno, rb.regime.valorPorAlunoAno)} destaque nota="Maior no curso mais curto só porque cada aluno cursa mais horas por ano; o repasse total e as horas de sala e de professor são os mesmos (veja a rotina abaixo)." />
              <Linha rotulo={`Acumulado em ${horizonte} anos`} a={reais.format(ra.valorAcumuladoHorizonte)} b={reais.format(rb.valorAcumuladoHorizonte)} dif={pctDiferenca(ra.valorAcumuladoHorizonte, rb.valorAcumuladoHorizonte)} destaque />
            </tbody>
          </table>
        </div>
        <Veredito ra={ra} rb={rb} virada={virada} quemVira={quemViraPrimeiro === ra ? "A" : "B"} />
      </section>

      <QuadroRotina a={a} b={b} chRealA={chRealA} chRealB={chRealB} rotina={rotina} onRotina={setRotina} alunosA={ra.regime.alunosAtivos} alunosB={rb.regime.alunosAtivos} />

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
        <ExemploDaConta a={{ ...a, chMatriz }} b={{ ...b, chMatriz }} parametros={parametros} />
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

const num2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num1ou0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** A conta de uma turma com os números no lugar das palavras: "32 alunos × 1,5 × (3.200 h ÷ 800) × 306 ÷ 1.096 dias". */
function formulaComNumeros(d: DecomposicaoMatricula): string {
  const partes = [`${num1ou0.format(d.alunos)} alunos`];
  if (d.icqa !== 1) partes.push(`${num1ou0.format(d.icqa)} (ICQA)`);
  partes.push(`${num1ou0.format(d.peso)} (peso)`);
  if (d.bonusAgropecuaria !== 1) partes.push(`${num1ou0.format(d.bonusAgropecuaria)} (agropecuária)`);
  partes.push(`(${inteiro.format(d.chEfetiva)} h ÷ 800)`);
  partes.push(`${inteiro.format(d.diasAtivos)} ÷ ${inteiro.format(d.diasDoCiclo)} dias`);
  return partes.join(" × ");
}

/** Um exemplo passo a passo com os números da simulação, para a pessoa ver de onde saem os valores da tabela. */
function ExemploDaConta({ a, b, parametros }: { a: OpcaoCurso; b: OpcaoCurso; parametros: ParametrosSimulacaoCurso }) {
  const itens = [
    { letra: "A", cor: COR_A, op: a },
    { letra: "B", cor: COR_B, op: b },
  ].map((x) => {
    const primeiro = exemploDoPrimeiroAno(x.op, parametros);
    const regime = exemploEmRegime(x.op, parametros);
    const mtRegime = regime.reduce((s, t) => s + t.matriculaTotal, 0);
    const valorRegime = mtRegime * valorMatriculaNoAno(parametros, mtRegime);
    return { ...x, primeiro, regime, mtRegime, valorRegime };
  });
  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Com os números desta simulação</h3>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        Cada fator abaixo vem dos campos preenchidos acima. Mude um deles e este exemplo muda junto. Os dias contados são os que a turma
        tem de aula dentro do ano (a turma entra em março, então o primeiro ano tem menos dias), divididos pelos dias do curso inteiro.
      </p>
      {itens.map(({ letra, cor, op, primeiro, regime, mtRegime, valorRegime }) => {
        const todasIguais = regime.every((t) => Math.abs(t.alunos - regime[0]!.alunos) < 1e-9);
        const acimaDoTeto = op.chTotalCiclo > op.chMatriz;
        return (
          <div key={letra} className="flex flex-col gap-1.5">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              <Marca cor={cor} /> Opção {letra}: {op.anosDuracao} anos, {inteiro.format(op.chTotalCiclo)} h
              {acimaDoTeto && ` (a MDO conta só ${inteiro.format(op.chMatriz)} h, o teto da matriz)`}
            </p>
            <p>
              <strong>Primeiro ano ({primeiro.ano}):</strong> entra a primeira turma, de {num1ou0.format(op.vagasPorAno)} alunos, em março.
            </p>
            <p className="pl-3 tabular-nums">
              {formulaComNumeros(primeiro)} = <strong>{num2.format(primeiro.matriculaTotal)}</strong> de Matrícula Total
              <br />
              {num2.format(primeiro.matriculaTotal)} × {reais2.format(primeiro.valorMatricula)} ={" "}
              <strong>{reais.format(primeiro.valor)}</strong> de repasse no ano
            </p>
            <p>
              <strong>Em regime (ano completo):</strong> {regime.length} {regime.length === 1 ? "turma" : "turmas"} em andamento ao mesmo tempo, cada
              uma com todos os dias do ano.
            </p>
            <p className="pl-3 tabular-nums">
              {todasIguais ? (
                <>
                  Cada turma: {formulaComNumeros(regime[0]!)} = {num2.format(regime[0]!.matriculaTotal)}
                  <br />
                  {regime.length} turmas somam <strong>{num2.format(mtRegime)}</strong>
                </>
              ) : (
                <>
                  {regime.map((t, i) => (
                    <span key={i}>
                      Turma {i + 1}: {formulaComNumeros(t)} = {num2.format(t.matriculaTotal)}
                      <br />
                    </span>
                  ))}
                  Somam <strong>{num2.format(mtRegime)}</strong>
                </>
              )}
              <br />
              {num2.format(mtRegime)} × {reais2.format(valorMatriculaNoAno(parametros, mtRegime))} = <strong>{reais.format(valorRegime)}</strong> por ano
            </p>
          </div>
        );
      })}
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

function CartaoOpcao({ op, onChange, cor, chMatriz, chReal, onChReal }: { op: OpcaoCurso; onChange: (o: OpcaoCurso) => void; cor: string; chMatriz: number; chReal: number; onChReal: (v: number) => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <Marca cor={cor} /> {op.rotulo}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo="Duração (anos)" valor={op.anosDuracao} passo={1} min={1} max={6} onChange={(v) => onChange({ ...op, anosDuracao: Math.max(1, Math.round(v)) })} />
        <Numero rotulo="CH mínima, a do cálculo (h)" valor={op.chTotalCiclo} passo={50} min={100} max={6000} onChange={(v) => onChange({ ...op, chTotalCiclo: v })} ajuda={op.chTotalCiclo > chMatriz ? `${inteiro.format(op.chTotalCiclo - chMatriz)} h acima do teto não rendem` : "A que a MDO conta para o repasse"} />
        <Numero rotulo="CH real do curso (h)" valor={chReal} passo={50} min={100} max={6000} onChange={onChReal} ajuda="A do PPC; só entra na rotina (horas por dia, turnos), não no repasse" />
        <Numero rotulo="Vagas por ano" valor={op.vagasPorAno} passo={5} min={1} max={400} onChange={(v) => onChange({ ...op, vagasPorAno: v })} />
        <Numero rotulo="Evasão por ano (%)" valor={Math.round(op.evasaoAnual * 100)} passo={1} min={0} max={60} onChange={(v) => onChange({ ...op, evasaoAnual: Math.min(0.9, Math.max(0, v / 100)) })} />
      </div>
    </section>
  );
}

const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "1 turno por dia e mais 1,7 contraturno por semana", ou "menos de um turno por dia". */
function textoDaRotina(r: RotinaCalculada): string {
  if (r.turnosPorDia < 0.995) return `menos de 1 turno por dia (${dec1.format(r.periodosPorDia)} períodos)`;
  if (r.contraturnosPorSemana < 0.05) return "1 turno por dia";
  return `1 turno por dia e mais ${dec1.format(r.contraturnosPorSemana)} contraturno${r.contraturnosPorSemana >= 1.95 ? "s" : ""} por semana`;
}

/**
 * O que cada opção exige do câmpus: horas por dia, períodos, turnos, e o que todas as turmas juntas ocupam de sala e de professor.
 * Não muda o repasse; responde se a opção cabe na rotina do câmpus.
 */
function QuadroRotina({
  a,
  b,
  chRealA,
  chRealB,
  rotina,
  onRotina,
  alunosA,
  alunosB,
}: {
  a: OpcaoCurso;
  b: OpcaoCurso;
  chRealA: number;
  chRealB: number;
  rotina: RotinaDoCampus;
  onRotina: (r: RotinaDoCampus) => void;
  alunosA: number;
  alunosB: number;
}) {
  const ra = calcularRotina(chRealA, a.anosDuracao, rotina);
  const rb = calcularRotina(chRealB, b.anosDuracao, rotina);
  const mudar = (m: Partial<RotinaDoCampus>) => onRotina({ ...rotina, ...m });
  const minutosTurno = rotina.periodosPorTurno * rotina.minutosPorPeriodo + (rotina.contarIntervalo ? rotina.minutosDeIntervalo : 0);
  const comEad = rotina.fracaoEad > 0;
  const linha = (rotulo: string, va: string, vb: string, nota?: string) => <Linha rotulo={rotulo} a={va} b={vb} dif="" nota={nota} />;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">A rotina no câmpus: cabe?</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        O repasse não muda com o número de anos, mas a rotina sim: a mesma carga horária em menos anos dá mais horas por dia, e pode exigir
        contraturno. Informe como o câmpus organiza o turno (o padrão é o de Venâncio Aires: 5 períodos de 45 minutos).
      </p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Numero rotulo="Minutos por período" valor={rotina.minutosPorPeriodo} passo={5} min={30} max={60} onChange={(v) => mudar({ minutosPorPeriodo: v })} />
        <Numero rotulo="Períodos por turno" valor={rotina.periodosPorTurno} passo={1} min={1} max={8} onChange={(v) => mudar({ periodosPorTurno: Math.round(v) })} ajuda="5 em Venâncio Aires, 6 em Lajeado" />
        <Numero rotulo="Dias letivos por ano" valor={rotina.diasLetivos} passo={5} min={100} max={250} onChange={(v) => mudar({ diasLetivos: Math.round(v) })} ajuda="200 é o mínimo legal" />
        <Numero rotulo="Minutos de intervalo por turno" valor={rotina.minutosDeIntervalo} passo={5} min={0} max={60} onChange={(v) => mudar({ minutosDeIntervalo: v })} />
        <Numero rotulo="Parte EAD da carga horária (%)" valor={Math.round(rotina.fracaoEad * 100)} passo={5} min={0} max={80} onChange={(v) => mudar({ fracaoEad: Math.min(0.8, Math.max(0, v / 100)) })} ajuda="Não ocupa sala nem turno" />
        <label className="flex items-center gap-2 self-center text-sm text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" checked={rotina.contarIntervalo} onChange={(e) => mudar({ contarIntervalo: e.target.checked })} />
          O intervalo conta como carga horária
        </label>
      </div>

      <div className="tabela-rolavel">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-2 pr-3"></th>
              <th className="px-3 py-2 text-right"><Marca cor={COR_A} /> {a.anosDuracao} anos</th>
              <th className="px-3 py-2 text-right"><Marca cor={COR_B} /> {b.anosDuracao} anos</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {linha("Horas por ano (CH mínima, a do cálculo)", `${inteiro.format(a.chTotalCiclo)} ÷ ${a.anosDuracao} = ${inteiro.format(a.chTotalCiclo / a.anosDuracao)} h`, `${inteiro.format(b.chTotalCiclo)} ÷ ${b.anosDuracao} = ${inteiro.format(b.chTotalCiclo / b.anosDuracao)} h`)}
            {linha("Horas por ano (CH real do curso)", `${inteiro.format(chRealA)} ÷ ${a.anosDuracao} = ${inteiro.format(ra.horasPorAno)} h`, `${inteiro.format(chRealB)} ÷ ${b.anosDuracao} = ${inteiro.format(rb.horasPorAno)} h`, "Daqui para baixo, tudo usa a CH real.")}
            {comEad && linha("Horas presenciais por ano", `${inteiro.format(ra.horasPresenciaisPorAno)} h`, `${inteiro.format(rb.horasPresenciaisPorAno)} h`, `Tirados os ${inteiro.format(rotina.fracaoEad * 100)}% a distância.`)}
            {linha("Horas por dia", `${dec2.format(ra.horasPorDia)} h`, `${dec2.format(rb.horasPorDia)} h`, `Horas presenciais por ano ÷ ${rotina.diasLetivos} dias letivos.`)}
            {linha("Turnos por dia", dec2.format(ra.turnosPorDia), dec2.format(rb.turnosPorDia), `Horas por dia ÷ ${dec2.format(ra.horasPorTurno)} h de um turno (${rotina.periodosPorTurno} × ${rotina.minutosPorPeriodo} min${rotina.contarIntervalo ? ` + ${rotina.minutosDeIntervalo} min de intervalo` : ""} = ${minutosTurno} min).`)}
            {linha("Períodos de aula por dia", dec1.format(ra.periodosPorDia), dec1.format(rb.periodosPorDia))}
            {linha("Rotina da turma", textoDaRotina(ra), textoDaRotina(rb), "Contraturno por semana: (turnos por dia − 1) × 5 dias.")}
            {linha("Turmas ao mesmo tempo, com todas em andamento", inteiro.format(ra.turmasAoMesmoTempo), inteiro.format(rb.turmasAoMesmoTempo))}
            {linha("Alunos no câmpus ao mesmo tempo", inteiro.format(alunosA), inteiro.format(alunosB))}
            {linha("Períodos de sala por semana, todas as turmas", inteiro.format(ra.periodosDeSalaPorSemana), inteiro.format(rb.periodosDeSalaPorSemana), "Turmas × períodos por semana. Com a mesma CH, empatam: o curso mais curto tem menos turmas, cada uma com mais horas.")}
            {linha("Períodos de aula de professor por ano, todas as turmas", inteiro.format(ra.periodosDeProfessorPorAno), inteiro.format(rb.periodosDeProfessorPorAno), "Sem contar turma dividida em laboratório.")}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        A conta supõe a carga horária em horas-relógio (60 minutos). Com todas as turmas em andamento, a mesma CH ocupa as mesmas salas e
        os mesmos professores nas duas opções; o que muda é a rotina de cada turma (contraturno, transporte, alimentação) e o ritmo nos
        primeiros anos, quando o curso mais curto entrega mais horas por ano. O encaixe real dos horários com os outros cursos do câmpus,
        a área de cada professor e os indicadores da instituição (evasão, retenção) ficam fora desta conta.
      </p>
    </section>
  );
}
