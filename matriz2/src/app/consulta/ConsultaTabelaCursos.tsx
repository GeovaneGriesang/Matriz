"use client";

import { useState } from "react";
import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { PROSE_LINK } from "@/lib/layoutWidths";
import { PainelComparacaoCursos } from "./PainelComparacaoCursos";
import { LegendaDaTabela } from "@/components/LegendaDaTabela";
import { legendaConsultaCursos } from "@/components/legendas";
import { NOME_DAS_TURMAS_RETIDAS, explicacaoDasTurmasRetidas, turmaEncerradaAntesDoAnoBase } from "@/lib/turmasRetidas";
import { rotuloDoCiclo } from "@/lib/identificacaoCiclo";

export interface CursoLinha {
  id: number;
  /** O código do ciclo na MDO, o mesmo nos dois anos: identifica a turma no Comparativo. */
  codigoCiclo?: string;
  curso: string;
  nivel: string | null;
  repasse: string;
  peso: number | null;
  matricula: number;
  valor: number;
  perda: number;
  inicio: string | null;
  termino: string | null;
  chMinimaMec: number | null;
  chMatriz: number | null;
  alunos: number | null;
  /** Modalidade do curso (técnico integrado, Proeja, superior...), ver `lib/modalidadeCurso.ts`. */
  modalidade?: string;
  modalidadeRotulo?: string;
  /** Tipo do curso por extenso (bacharelado, licenciatura, FIC...), para distinguir dentro de uma modalidade. */
  tipoCursoLegivel?: string;
  /** Presencial ou a distância. */
  ensino?: "presencial" | "ead";
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// As datas do ciclo são dias do calendário à meia-noite UTC: no fuso do navegador apareceriam como o dia anterior.
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const periodo = (c: CursoLinha) => (c.inicio && c.termino ? `${data.format(new Date(c.inicio))} a ${data.format(new Date(c.termino))}` : "sem data");

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop. Os campos chegam já como `number` (a
 * página converte os `Decimal` do Prisma antes de passar para cá; um `Decimal`
 * também não atravessaria essa fronteira, por ser uma instância de classe, não um
 * dado simples).
 */
export function ConsultaTabelaCursos({
  cursos,
  ano,
  unidadeId,
}: {
  cursos: CursoLinha[];
  ano: number;
  unidadeId: number;
}) {
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  function alternar(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const comparando = cursos.filter((c) => selecionados.has(c.id));
  const retidas = cursos.filter((c) => turmaEncerradaAntesDoAnoBase(c.termino, ano));
  const regulares = cursos.filter((c) => !turmaEncerradaAntesDoAnoBase(c.termino, ano));
  const somaRegulares = regulares.reduce((s, c) => s + c.valor, 0);
  const somaRetidas = retidas.reduce((s, c) => s + c.valor, 0);
  const exemploRetida = retidas[0];

  const colunas = [
            {
              chave: "comparar",
              rotulo: "Comparar",
              ordenavel: false,
              valor: () => null,
              render: (c) => (
                <input
                  type="checkbox"
                  checked={selecionados.has(c.id)}
                  onChange={() => alternar(c.id)}
                  aria-label={`Comparar ${c.curso}`}
                  className="h-4 w-4 accent-if-green"
                />
              ),
            },
            { chave: "curso", rotulo: "Curso", valor: (c) => c.curso },
            { chave: "ciclo", rotulo: "Ciclo", valor: (c) => c.codigoCiclo ?? null, render: (c) => <span className="whitespace-nowrap text-xs tabular-nums">{c.codigoCiclo ?? "-"}</span> },
            { chave: "turma", rotulo: "Turma", valor: (c) => c.inicio, render: (c) => <span className="whitespace-nowrap text-xs">{periodo(c)}</span> },
            { chave: "nivel", rotulo: "Nível", valor: (c) => c.nivel, render: (c) => c.nivel ?? "não informado" },
            {
              chave: "repasse",
              rotulo: "Repasse",
              valor: (c) => c.repasse,
              render: (c) => c.repasse.replace("_", " "),
            },
            {
              chave: "peso",
              rotulo: "Peso",
              alinhamento: "right",
              valor: (c) => c.peso,
              render: (c) => (c.peso !== null ? decimal.format(c.peso) : "não informado"),
            },
            {
              chave: "matricula",
              rotulo: "Matrícula",
              alinhamento: "right",
              valor: (c) => c.matricula,
              render: (c) => decimal.format(c.matricula),
            },
            {
              chave: "valor",
              rotulo: "Recebido",
              alinhamento: "right",
              valor: (c) => c.valor,
              render: (c) => reais.format(c.valor),
            },
            {
              chave: "perda",
              rotulo: "Perda",
              alinhamento: "right",
              valor: (c) => c.perda,
              render: (c) => <span className="text-if-red dark:text-red-400">{reais.format(c.perda)}</span>,
            },
          ] satisfies ColunaOrdenavel<CursoLinha>[];

  return (
    <div className="flex flex-col gap-4">
      <LegendaDaTabela itens={legendaConsultaCursos(cursos[0])} exemplo={cursos[0] ? `${cursos[0].curso}, ${rotuloDoCiclo(cursos[0])}` : undefined} />
      {regulares.length > 0 && <TabelaOrdenavel linhas={regulares} chaveLinha={(c) => c.id} colunas={colunas} />}

      {retidas.length > 0 && (
        <div className="flex flex-col gap-2 border-t-2 border-amber-300 px-4 pt-3 dark:border-amber-800">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {NOME_DAS_TURMAS_RETIDAS}: {retidas.length} {retidas.length === 1 ? "turma" : "turmas"}, {reais.format(somaRetidas)}
          </h3>
          <p className="text-xs font-normal text-neutral-600 dark:text-neutral-400">
            {explicacaoDasTurmasRetidas(ano)}
            {exemploRetida && (
              <>
                {" "}
                Exemplo: a turma de {exemploRetida.curso} ({rotuloDoCiclo(exemploRetida)}) ainda gera {reais.format(exemploRetida.valor)}.
              </>
            )}
          </p>
          <p className="text-xs font-normal text-neutral-600 dark:text-neutral-400">
            A soma fecha com a matriz: {reais.format(somaRegulares)} das turmas do ano-base + {reais.format(somaRetidas)} destas = {reais.format(somaRegulares + somaRetidas)}.
          </p>
          <TabelaOrdenavel linhas={retidas} chaveLinha={(c) => c.id} colunas={colunas} />
        </div>
      )}

      {comparando.length >= 2 && (
        <PainelComparacaoCursos cursos={comparando} onRemover={alternar} onLimpar={() => setSelecionados(new Set())} ano={ano} />
      )}

      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Quer comparar com um curso de outro câmpus?{" "}
        <Link
          href={`/consulta/comparar?ano=${ano}&campus1=${unidadeId}${
            comparando[0] ? `&curso1=${comparando[0].id}` : ""
          }`}
          className={PROSE_LINK}
        >
          Comparar entre câmpus
        </Link>
        .
      </p>
    </div>
  );
}
