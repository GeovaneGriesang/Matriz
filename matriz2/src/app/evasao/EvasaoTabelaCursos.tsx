"use client";

import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface CursoLinha {
  curso: string;
  nivel: string | null;
  ciclos: number;
  recebido: number;
  perda: number;
  taxa: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop.
 */
export function EvasaoTabelaCursos({ cursos }: { cursos: CursoLinha[] }) {
  return (
    <TabelaOrdenavel
      linhas={cursos}
      chaveLinha={(c) => `${c.curso}-${c.nivel}-${cursos.indexOf(c)}`}
      cabecalhoFixo
      corpoVazio={
        <tr>
          <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
            Nenhum curso com perda registrada neste recorte.
          </td>
        </tr>
      }
      colunas={
        [
          { chave: "curso", rotulo: "Curso", valor: (c) => c.curso },
          { chave: "nivel", rotulo: "Nível", valor: (c) => c.nivel, render: (c) => c.nivel ?? "-" },
          {
            chave: "ciclos",
            rotulo: "Ciclos",
            alinhamento: "right",
            valor: (c) => c.ciclos,
            render: (c) => <span className="text-neutral-600 dark:text-neutral-400">{inteiro.format(c.ciclos)}</span>,
          },
          {
            chave: "recebido",
            rotulo: "Recebido",
            alinhamento: "right",
            valor: (c) => c.recebido,
            render: (c) => <span className="text-neutral-600 dark:text-neutral-400">{reais.format(c.recebido)}</span>,
          },
          {
            chave: "perda",
            rotulo: "Perda",
            alinhamento: "right",
            valor: (c) => c.perda,
            render: (c) => <span className="font-medium text-if-red dark:text-red-400">{reais.format(c.perda)}</span>,
          },
          {
            chave: "taxa",
            rotulo: "Taxa",
            alinhamento: "right",
            valor: (c) => c.taxa,
            render: (c) => (
              <span className={c.taxa >= 15 ? "font-semibold text-if-red dark:text-red-400" : ""}>
                {doisDecimais.format(c.taxa)}%
              </span>
            ),
          },
        ] satisfies ColunaOrdenavel<CursoLinha>[]
      }
    />
  );
}
