"use client";

import { useMemo, useState } from "react";
import { ContextoDaTela } from "@/components/chat/ChatDaTela";
import type { Repasse } from "@/lib/mdo/matriculaTotal";
import { projetarMatriculados, situacaoDoCiclo, somarProjecao, type CicloProjetavel, type Premissas, type ResumoAno } from "@/lib/mdo/projecaoCiclos";

/** Um ciclo como vem do servidor: datas em texto, porque Date não atravessa para o componente de cliente. */
export interface CicloSerial {
  id: number;
  unidadeId: number;
  curso: string;
  tipoCurso: string;
  tipoOferta: string;
  repasse: Repasse;
  inicio: string;
  termino: string;
  jubilamento: string;
  chCiclo: number;
  chMec: number;
  chMatriz: number;
  peso: number;
  agropecuaria: boolean;
  alunos: number;
  valorPorMT: number;
}

export interface TaxasPadrao {
  presencial: number;
  ead: number;
  /** De onde vieram, em uma frase. */
  origem: string;
  porAno: Array<{ anoBase: number; presencial: number | null; ead: number | null }>;
  /** Verdadeiro quando a PNP não tinha o dado e a tela usou um valor de partida qualquer. */
  semDado: boolean;
}

export interface RetencaoPadrao {
  /** Fração dos alunos do término ainda matriculados 1, 2 e 3 anos depois. */
  retencao: number[];
  /** Verdadeiro quando foi medida nos ciclos da instituição; falso quando é o valor de partida. */
  observada: boolean;
  alunosNoTermino: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (x: number) => `${decimal.format(x * 100)}%`;

function paraCiclo(c: CicloSerial): CicloProjetavel {
  return { ...c, inicio: new Date(c.inicio), termino: new Date(c.termino), jubilamento: new Date(c.jubilamento) };
}

function somarResumos(lista: ResumoAno[][], anos: number, anoBase0: number): ResumoAno[] {
  return Array.from({ length: anos }, (_, k) => {
    const base = lista[0]?.[k];
    return lista.reduce(
      (s, r) => ({
        ...s,
        matriculaTotal: s.matriculaTotal + r[k]!.matriculaTotal,
        valor: s.valor + r[k]!.valor,
        valorReposicao: s.valorReposicao + r[k]!.valorReposicao,
        alunosContados: s.alunosContados + r[k]!.alunosContados,
      }),
      { anoBase: anoBase0 + k, anoCiclo: base?.anoCiclo ?? anoBase0 + k + 2, matriculaTotal: 0, valor: 0, valorReposicao: 0, alunosContados: 0 },
    );
  });
}

export function ProjecaoCiclos({
  instituicao,
  anoCiclo,
  anoBase0,
  campi,
  ciclos,
  taxasPadrao,
  retencao,
  campusInicialId,
}: {
  instituicao: string;
  anoCiclo: number;
  anoBase0: number;
  campi: Array<{ id: number; nome: string }>;
  ciclos: CicloSerial[];
  taxasPadrao: TaxasPadrao;
  retencao: RetencaoPadrao;
  campusInicialId: number | null;
}) {
  const [campusId, setCampusId] = useState<number | null>(campusInicialId);
  const [anos, setAnos] = useState(5);
  const [evPresencial, setEvPresencial] = useState(Math.round(taxasPadrao.presencial * 1000) / 10);
  const [evEad, setEvEad] = useState(Math.round(taxasPadrao.ead * 1000) / 10);
  const [verTodosOsCursos, setVerTodosOsCursos] = useState(false);

  const taxas = useMemo<Premissas>(
    () => ({ evasao: { presencial: evPresencial / 100, ead: evEad / 100 }, retencao: retencao.retencao }),
    [evPresencial, evEad, retencao],
  );
  const todos = useMemo(() => ciclos.map(paraCiclo), [ciclos]);
  const porCampus = useMemo(() => {
    const m = new Map<number, CicloProjetavel[]>();
    for (const c of todos) m.set(c.unidadeId, [...(m.get(c.unidadeId) ?? []), c]);
    return m;
  }, [todos]);

  // Cada câmpus é projetado uma vez; a instituição inteira é a soma deles.
  const resumoPorCampus = useMemo(() => {
    const m = new Map<number, ResumoAno[]>();
    for (const [id, lista] of porCampus) m.set(id, somarProjecao(lista, anoBase0, anos, taxas));
    return m;
  }, [porCampus, anoBase0, anos, taxas]);
  const resumoInstituicao = useMemo(() => somarResumos([...resumoPorCampus.values()], anos, anoBase0), [resumoPorCampus, anos, anoBase0]);

  const resumo = campusId === null ? resumoInstituicao : (resumoPorCampus.get(campusId) ?? somarResumos([], anos, anoBase0));
  const ciclosDoRecorte = useMemo(() => (campusId === null ? todos : (porCampus.get(campusId) ?? [])), [campusId, todos, porCampus]);
  const nomeDoRecorte = campusId === null ? instituicao : (campi.find((c) => c.id === campusId)?.nome ?? "");

  // Por curso: o que cada curso ainda rende, só com os alunos de hoje.
  const cursos = useMemo(() => {
    const m = new Map<string, { curso: string; oferta: string; ciclos: number; alunos: number; anoTermino: number; valores: number[]; total: number }>();
    for (const c of ciclosDoRecorte) {
      if (c.alunos <= 0) continue;
      const chave = `${c.curso}|${c.tipoOferta}`;
      const pontos = projetarMatriculados(c, anoBase0, anos, taxas);
      const sit = situacaoDoCiclo(c, anoBase0);
      const atual = m.get(chave) ?? { curso: c.curso, oferta: c.tipoOferta, ciclos: 0, alunos: 0, anoTermino: 0, valores: Array(anos).fill(0) as number[], total: 0 };
      atual.ciclos += 1;
      atual.alunos += c.alunos;
      if (sit.regular) atual.anoTermino = Math.max(atual.anoTermino, sit.anoTermino);
      pontos.forEach((p, k) => {
        atual.valores[k]! += p.valor;
        atual.total += p.valor;
      });
      m.set(chave, atual);
    }
    return [...m.values()].sort((a, b) => b.valores[0]! - a.valores[0]! || b.total - a.total);
  }, [ciclosDoRecorte, anoBase0, anos, taxas]);

  const fimDoHorizonte = anoBase0 + anos - 1;
  const comAlunos = ciclosDoRecorte.filter((c) => c.alunos > 0);
  const regulares = comAlunos.filter((c) => situacaoDoCiclo(c, anoBase0).regular);
  const atrasados = comAlunos.filter((c) => !situacaoDoCiclo(c, anoBase0).regular);
  const ultimoTermino = regulares.reduce((m, c) => Math.max(m, c.termino.getUTCFullYear()), 0);
  const terminamDepois = regulares.filter((c) => c.termino.getUTCFullYear() > fimDoHorizonte);
  const alunosAtrasados = atrasados.reduce((s, c) => s + c.alunos, 0);

  const primeiro = resumo[0]?.valor ?? 0;
  const ultimo = resumo[resumo.length - 1]?.valor ?? 0;
  const totalHorizonte = resumo.reduce((s, r) => s + r.valor, 0);
  const maxValor = Math.max(...resumo.map((r) => r.valor + r.valorReposicao), 1);
  const cursosVisiveis = verTodosOsCursos ? cursos : cursos.slice(0, 25);

  const textoParaOChat = [
    `Projeção de ${nomeDoRecorte}, ciclos orçamentários ${anoCiclo} a ${anoCiclo + anos - 1}.`,
    `Evasão anual: ${decimal.format(evPresencial)}% presencial e ${decimal.format(evEad)}% a distância. Retidos depois do término, de cada 100 alunos: ${retencao.retencao.map((r) => Math.round(r * 100)).join(", ")} em um, dois e três anos.`,
    ...resumo.map(
      (r) =>
        `${r.anoCiclo}: só os matriculados hoje ${reais.format(r.valor)} (${primeiro > 0 ? decimal.format((r.valor / primeiro) * 100) : "-"}% do primeiro ano), turmas novas estimadas ${reais.format(r.valorReposicao)}, ${inteiro.format(Math.round(r.alunosContados))} alunos contados.`,
    ),
    `Soma para todos terminarem: ${reais.format(totalHorizonte)}. Último ciclo regular termina em ${ultimoTermino || "nenhum"}. Ciclos atrasados: ${atrasados.length}.`,
  ].join("\n");

  return (
    <div className="flex flex-col gap-6">
      <ContextoDaTela texto={textoParaOChat} />
      <section className="grid gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
        <h2 className="col-span-full text-sm font-semibold text-neutral-900 dark:text-neutral-100">O que a projeção supõe</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">Anos à frente</span>
          <select
            value={anos}
            onChange={(e) => setAnos(Number(e.target.value))}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} anos ({anoCiclo} a {anoCiclo + n - 1})
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">Ciclos orçamentários, a partir do {anoCiclo}.</span>
        </label>
        <Percentual
          rotulo="Evasão anual, presencial (%)"
          valor={evPresencial}
          onChange={setEvPresencial}
          padrao={Math.round(taxasPadrao.presencial * 1000) / 10}
          ajuda={taxasPadrao.semDado ? "Sem dado da PNP: valor de partida" : "Média do instituto na PNP"}
        />
        <Percentual
          rotulo="Evasão anual, a distância (%)"
          valor={evEad}
          onChange={setEvEad}
          padrao={Math.round(taxasPadrao.ead * 1000) / 10}
          ajuda={taxasPadrao.semDado ? "Sem dado da PNP: valor de partida" : "Média do instituto na PNP"}
        />
        <div className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">De onde vêm as taxas</span>
          <span>{taxasPadrao.origem}</span>
          {taxasPadrao.porAno.length > 0 && (
            <span>
              {taxasPadrao.porAno.map((a) => `${a.anoBase}: ${a.presencial !== null ? pct(a.presencial) : "-"} presencial, ${a.ead !== null ? pct(a.ead) : "-"} a distância`).join("; ")}
            </span>
          )}
          <span className="mt-1">
            <strong className="font-medium text-neutral-700 dark:text-neutral-300">Retidos depois do término:</strong> de cada 100 alunos no término, ficam{" "}
            {retencao.retencao.map((r) => inteiro.format(Math.round(r * 100))).join(", ")} um, dois e três anos depois.{" "}
            {retencao.observada
              ? `Medido nos ${inteiro.format(Math.round(retencao.alunosNoTermino))} alunos dos ciclos que terminam em ${anoBase0}, contra os ciclos terminados nos três anos anteriores.`
              : "Sem alunos suficientes para medir: valor de partida."}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Câmpus</span>
        <div className="flex flex-wrap gap-1">
          <BotaoCampus ativo={campusId === null} onClick={() => setCampusId(null)}>
            {instituicao} inteiro
          </BotaoCampus>
          {campi.map((c) => (
            <BotaoCampus key={c.id} ativo={campusId === c.id} onClick={() => setCampusId(c.id)}>
              {c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}
            </BotaoCampus>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          titulo="Para todos terminarem"
          valor={reais.format(totalHorizonte)}
          nota={`Soma de ${anoCiclo} a ${anoCiclo + anos - 1} para os alunos que já estão matriculados em ${nomeDoRecorte}, sem nenhuma turma nova.`}
        />
        <Cartao
          titulo={`Em ${anoCiclo + anos - 1}, sobre ${anoCiclo}`}
          valor={primeiro > 0 ? `${decimal.format((ultimo / primeiro) * 100)}%` : "-"}
          nota={`${reais.format(ultimo)} contra ${reais.format(primeiro)}: o que sobra da turma atual no último ano mostrado.`}
        />
        <Cartao
          titulo="Último ciclo regular termina em"
          valor={ultimoTermino > 0 ? String(ultimoTermino) : "-"}
          nota={
            terminamDepois.length > 0
              ? `${inteiro.format(terminamDepois.length)} ciclo(s) terminam depois de ${fimDoHorizonte} (ano-base): aumente os anos à frente para vê-los acabar.`
              : `Todos os ${inteiro.format(regulares.length)} ciclos regulares acabam dentro do período mostrado.`
          }
        />
        <Cartao
          titulo="Ciclos atrasados"
          valor={inteiro.format(atrasados.length)}
          nota={`${inteiro.format(Math.round(alunosAtrasados))} alunos já passaram do término e contam metade até o fim do prazo de jubilamento (3 anos), e depois saem.`}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ano a ano, {nomeDoRecorte}</h2>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Ciclo orçamentário</th>
                <th className="px-3 py-2">Dado da PNP de</th>
                <th className="px-3 py-2 text-right">Alunos que a MDO conta</th>
                <th className="px-3 py-2 text-right">Só os matriculados hoje</th>
                <th className="px-3 py-2 text-right">Sobre o primeiro ano</th>
                <th className="px-3 py-2 text-right">Turmas novas (estimativa)</th>
                <th className="px-3 py-2 text-right">Com reposição das turmas</th>
                <th className="w-48 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {resumo.map((r, k) => (
                <tr key={r.anoBase} className={k === 0 ? "bg-neutral-50 dark:bg-neutral-900" : ""}>
                  <td className="px-3 py-2 font-medium">
                    {r.anoCiclo}
                    {k === 0 && <span className="ml-2 text-xs font-normal text-neutral-500">hoje</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.anoBase}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(Math.round(r.alunosContados))}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{reais.format(r.valor)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{primeiro > 0 ? `${decimal.format((r.valor / primeiro) * 100)}%` : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600 dark:text-neutral-400">{reais.format(r.valorReposicao)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{reais.format(r.valor + r.valorReposicao)}</td>
                  <td className="px-3 py-2">
                    <div className="flex h-3 w-full overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800" title="Verde: quem já está matriculado. Azul: turmas novas estimadas.">
                      <div className="bg-if-green" style={{ width: `${(r.valor / maxValor) * 100}%` }} />
                      <div className="bg-sky-500" style={{ width: `${(r.valorReposicao / maxValor) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500">
          Valores em reais de hoje, com o valor da matrícula de cada ciclo como está no ciclo {anoCiclo}. A coluna verde responde "quanto é preciso para os que já
          estão aqui terminarem"; a soma com a azul é o regime de quem continua ofertando os mesmos cursos.
        </p>
      </section>

      {campusId === null && (
        <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Por câmpus, só os matriculados hoje</h2>
          <div className="tabela-rolavel">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Câmpus</th>
                  {resumoInstituicao.map((r) => (
                    <th key={r.anoCiclo} className="px-3 py-2 text-right">
                      {r.anoCiclo}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Último ano sobre o primeiro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {campi.map((c) => {
                  const r = resumoPorCampus.get(c.id);
                  if (!r || r[0]!.valor <= 0) return null;
                  return (
                    <tr key={c.id} className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900" onClick={() => setCampusId(c.id)}>
                      <td className="px-3 py-2 font-medium">{c.nome.replace(/^CAMPUS( AVANÇADO)? /, "")}</td>
                      {r.map((x) => (
                        <td key={x.anoCiclo} className="px-3 py-2 text-right tabular-nums">
                          {reais.format(x.valor)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums">{decimal.format((r[r.length - 1]!.valor / r[0]!.valor) * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Por curso, só os matriculados hoje, {nomeDoRecorte}</h2>
        <div className="tabela-rolavel">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Curso</th>
                <th className="px-3 py-2 text-right">Ciclos</th>
                <th className="px-3 py-2 text-right">Alunos hoje</th>
                <th className="px-3 py-2 text-right">Termina em</th>
                {resumo.map((r) => (
                  <th key={r.anoCiclo} className="px-3 py-2 text-right">
                    {r.anoCiclo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {cursosVisiveis.map((c) => (
                <tr key={`${c.curso}|${c.oferta}`}>
                  <td className="px-3 py-2">
                    {c.curso}
                    {c.oferta && c.oferta !== "NÃO SE APLICA" ? <span className="text-xs text-neutral-500"> ({c.oferta.toLowerCase()})</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.ciclos}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inteiro.format(Math.round(c.alunos))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.anoTermino > 0 ? c.anoTermino : <span className="text-xs text-neutral-500">atrasado</span>}</td>
                  {c.valores.map((v, k) => (
                    <td key={k} className="px-3 py-2 text-right tabular-nums">
                      {v > 0 ? reais.format(v) : <span className="text-neutral-400">-</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cursos.length > 25 && (
          <button type="button" onClick={() => setVerTodosOsCursos((v) => !v)} className="self-start text-sm font-medium text-if-green underline">
            {verTodosOsCursos ? "Mostrar só os 25 maiores" : `Mostrar os ${cursos.length} cursos`}
          </button>
        )}
        <p className="text-xs text-neutral-500">
          "Termina em" é o ano do último ciclo regular do curso; "atrasado" quer dizer que todos os ciclos já passaram do término. Um zero ("-") é o ano em que o
          curso deixa de contar na matriz, seja porque todos terminaram e o prazo de jubilamento acabou, seja porque a evasão levou a turma a zero.
        </p>
      </section>

      <details open className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-neutral-100">Como esta projeção funciona</summary>
        <div className="mt-3 flex flex-col gap-2">
          <p>
            <strong>Ponto de partida.</strong> Cada ciclo de curso do ciclo orçamentário {anoCiclo} de {instituicao}, com os alunos que a MDO contou
            (matrículas de {anoBase0}), as datas de início e término, a carga horária, o peso e o valor da matrícula que o ciclo recebe hoje. O primeiro
            ano da tabela é exatamente o valor de hoje.
          </p>
          <p>
            <strong>Por que "dado da PNP de" é dois anos antes.</strong> A matriz de um ano usa a PNP de dois anos antes: o ciclo {anoCiclo} conta os alunos de {anoBase0}.
            Por isso um aluno que termina o curso em {anoBase0 + 5} só deixa de pesar na matriz de {anoBase0 + 7}.
          </p>
          <p>
            <strong>Cada ano seguinte.</strong> Até o término, os alunos de cada ciclo diminuem pela evasão anual (a média dos últimos anos do instituto na
            modalidade do curso, que você pode trocar). Depois do término a maioria se forma e só uma parte continua matriculada, os retidos; essa parte é medida
            nos próprios ciclos de hoje. A Matrícula Total é recalculada com a mesma regra da MDO: só contam os dias do ciclo que caem no ano, e o aluno que passou
            do término conta metade até o fim do prazo de jubilamento (3 anos; o curso de qualificação profissional não tem prazo).
          </p>
          <p>
            <strong>Duas leituras.</strong> "Só os matriculados hoje" é o dinheiro de que o câmpus precisa para que todos que já estão aqui consigam terminar, sem
            nenhuma turma nova. "Turmas novas" é uma estimativa do que entraria se cada ciclo regular fosse reposto, no dia seguinte ao término, por uma turma da mesma
            duração e do tamanho da matrícula de entrada (a de hoje, corrigida pela evasão que já houve); é o regime de quem continua ofertando o curso.
          </p>
          <p>
            <strong>O que não está aqui.</strong> O valor da matrícula fica fixo no de hoje: a projeção não sabe quanto será o orçamento da rede nem quantas matrículas os
            outros institutos terão, e é isso que move o valor de cada matrícula. Cursos novos, mudança de peso ou de carga horária pela MDO e o Piso Mínimo também ficam de fora.
            Serve para ver a ordem de grandeza e a forma da curva, não para prometer um valor.
          </p>
        </div>
      </details>
    </div>
  );
}

function Percentual({ rotulo, valor, onChange, padrao, ajuda }: { rotulo: string; valor: number; onChange: (v: number) => void; padrao: number; ajuda: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{rotulo}</span>
      <input
        type="number"
        min={0}
        max={80}
        step={0.5}
        value={valor}
        onChange={(e) => onChange(Math.min(80, Math.max(0, Number(e.target.value) || 0)))}
        className="rounded border border-neutral-300 bg-white px-2 py-1.5 tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
      />
      <span className="text-xs text-neutral-500">
        {ajuda}
        {valor !== padrao && (
          <>
            {" "}
            <button type="button" onClick={() => onChange(padrao)} className="font-medium text-if-green underline">
              voltar a {decimal.format(padrao)}%
            </button>
          </>
        )}
      </span>
    </label>
  );
}

function BotaoCampus({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded px-2 py-1 text-xs font-medium ${
        ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{titulo}</span>
      <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{valor}</span>
      <span className="text-xs text-neutral-600 dark:text-neutral-400">{nota}</span>
    </div>
  );
}
