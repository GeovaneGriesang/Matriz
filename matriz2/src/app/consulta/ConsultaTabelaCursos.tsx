"use client";

import { useState } from "react";
import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { PROSE_LINK } from "@/lib/layoutWidths";
import { PainelComparacaoCursos } from "./PainelComparacaoCursos";

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
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
        <PainelComparacaoCursos cursos={comparando} onRemover={alternar} onLimpar={() => setSelecionados(new Set())} />
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
