"use client";

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
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop. Os campos chegam já como `number` (a
 * página converte os `Decimal` do Prisma antes de passar para cá — um `Decimal`
 * também não atravessaria essa fronteira, por ser uma instância de classe, não um
 * dado simples).
 */
export function ConsultaTabelaCursos({ cursos }: { cursos: CursoLinha[] }) {
  return (
    <TabelaOrdenavel
      linhas={cursos}
      chaveLinha={(c) => c.id}
      cabecalhoFixo
      colunas={
        [
          { chave: "curso", rotulo: "Curso", valor: (c) => c.curso },
          { chave: "nivel", rotulo: "Nível", valor: (c) => c.nivel, render: (c) => c.nivel ?? "—" },
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
            render: (c) => (c.peso !== null ? decimal.format(c.peso) : "—"),
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
  );
}
