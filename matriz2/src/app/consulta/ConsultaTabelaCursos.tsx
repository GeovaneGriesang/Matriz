"use client";

import { useState } from "react";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface CursoLinha {
  id: number;
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
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const data = new Intl.DateTimeFormat("pt-BR");

function formatarData(iso: string | null): string {
  return iso ? data.format(new Date(iso)) : "não informado";
}

function diasEntre(inicioIso: string | null, terminoIso: string | null): number | null {
  if (!inicioIso || !terminoIso) return null;
  const dias = (new Date(terminoIso).getTime() - new Date(inicioIso).getTime()) / 86_400_000;
  return dias > 0 ? Math.round(dias) : null;
}

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop. Os campos chegam já como `number` (a
 * página converte os `Decimal` do Prisma antes de passar para cá — um `Decimal`
 * também não atravessaria essa fronteira, por ser uma instância de classe, não um
 * dado simples).
 */
export function ConsultaTabelaCursos({ cursos }: { cursos: CursoLinha[] }) {
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

  return (
    <div className="flex flex-col gap-4">
      <TabelaOrdenavel
        linhas={cursos}
        chaveLinha={(c) => c.id}
        cabecalhoFixo
        colunas={
          [
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
          ] satisfies ColunaOrdenavel<CursoLinha>[]
        }
      />

      {comparando.length >= 2 && (
        <PainelComparacao cursos={comparando} onRemover={alternar} onLimpar={() => setSelecionados(new Set())} />
      )}
    </div>
  );
}

function PainelComparacao({
  cursos,
  onRemover,
  onLimpar,
}: {
  cursos: CursoLinha[];
  onRemover: (id: number) => void;
  onLimpar: () => void;
}) {
  const linhas: { rotulo: string; valor: (c: CursoLinha) => string }[] = [
    { rotulo: "Nível", valor: (c) => c.nivel ?? "não informado" },
    { rotulo: "Repasse", valor: (c) => c.repasse.replace("_", " ") },
    { rotulo: "Início do ciclo", valor: (c) => formatarData(c.inicio) },
    { rotulo: "Término do ciclo", valor: (c) => formatarData(c.termino) },
    {
      rotulo: "Dias do ciclo",
      valor: (c) => {
        const dias = diasEntre(c.inicio, c.termino);
        return dias !== null ? `${dias} dias (≈${decimal.format(dias / 365)} anos)` : "não informado";
      },
    },
    { rotulo: "CH mínima MEC", valor: (c) => (c.chMinimaMec !== null ? `${c.chMinimaMec} h` : "não informado") },
    { rotulo: "CH Matriz", valor: (c) => (c.chMatriz !== null ? `${c.chMatriz} h` : "não informado") },
    {
      rotulo: "CH Matriz ÷ CH mínima MEC",
      valor: (c) =>
        c.chMatriz !== null && c.chMinimaMec ? decimal.format(c.chMatriz / c.chMinimaMec) : "não informado",
    },
    { rotulo: "Peso do curso na matriz", valor: (c) => (c.peso !== null ? decimal.format(c.peso) : "não informado") },
    { rotulo: "Alunos (matriz)", valor: (c) => (c.alunos !== null ? decimal.format(c.alunos) : "não informado") },
    { rotulo: "Matrícula equalizada gerada", valor: (c) => decimal.format(c.matricula) },
    {
      rotulo: "Matrícula equalizada por aluno",
      valor: (c) => (c.alunos ? decimal.format(c.matricula / c.alunos) : "não informado"),
    },
    { rotulo: "Valor recebido", valor: (c) => reais.format(c.valor) },
    { rotulo: "Perda por evasão", valor: (c) => reais.format(c.perda) },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-if-green/40 bg-if-green/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
          Comparando {cursos.length} cursos
        </h3>
        <button
          type="button"
          onClick={onLimpar}
          className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          limpar comparação
        </button>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Os valores vêm prontos da 6ª fase da MDO; a matriz equalizada já considera duração do ciclo,
        peso do curso e carga horária, mas o Matriz2 não refaz essa conta, só mostra os componentes
        que a própria MDO publica por ciclo de curso.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/60 text-left dark:bg-neutral-950/40">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-500"></th>
              {cursos.map((c) => (
                <th key={c.id} className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                  <div className="flex items-start justify-between gap-2">
                    <span>{c.curso}</span>
                    <button
                      type="button"
                      onClick={() => onRemover(c.id)}
                      aria-label={`Remover ${c.curso} da comparação`}
                      className="text-neutral-400 hover:text-if-red"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.rotulo} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{linha.rotulo}</td>
                {cursos.map((c) => (
                  <td key={c.id} className="px-3 py-2 tabular-nums">
                    {linha.valor(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
