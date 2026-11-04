"use client";

import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { LegendaDaTabela } from "@/components/LegendaDaTabela";
import { legendaEvasao } from "@/components/legendas";
import { rotuloDoCiclo } from "@/lib/identificacaoCiclo";

export interface TurmaDaEvasao {
  id: number;
  codigoCiclo: string;
  inicio: string | null;
  termino: string | null;
  /** O câmpus da turma, quando a tabela cobre a instituição inteira. */
  campus: string | null;
  recebido: number;
  perda: number;
}

export interface CursoLinha {
  curso: string;
  nivel: string | null;
  ciclos: number;
  recebido: number;
  perda: number;
  taxa: number;
  /** As turmas do curso, abertas pelo + da linha. */
  turmas: TurmaDaEvasao[];
}

/** As turmas de um curso, no quadro logo abaixo da linha dele: a soma delas é a linha do curso. */
function TurmasDoCurso({ c }: { c: CursoLinha }) {
  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <table className="w-full text-xs" data-sem-ferramentas>
        <thead className="bg-neutral-50 text-left text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className="px-3 py-1.5 font-medium">Turma e período</th>
            {c.turmas.some((t) => t.campus) && <th className="px-3 py-1.5 font-medium">Câmpus</th>}
            <th className="px-3 py-1.5 text-right font-medium">Recebido</th>
            <th className="px-3 py-1.5 text-right font-medium">Perda</th>
            <th className="px-3 py-1.5 text-right font-medium">Taxa</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {c.turmas.map((t) => (
            <tr key={t.id}>
              <td className="whitespace-nowrap px-3 py-1.5">{rotuloDoCiclo(t)}</td>
              {t.campus && <td className="px-3 py-1.5">{t.campus}</td>}
              <td className="px-3 py-1.5 text-right tabular-nums">{reais.format(t.recebido)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-if-red dark:text-red-400">{reais.format(t.perda)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t.recebido > 0 ? `${doisDecimais.format((t.perda / t.recebido) * 100)}%` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
    <>
      <LegendaDaTabela itens={legendaEvasao(cursos[0]?.curso ?? "", cursos[0])} exemplo={cursos[0]?.curso} />
    <TabelaOrdenavel
      linhas={cursos}
      chaveLinha={(c) => `${c.curso}-${c.nivel}-${cursos.indexOf(c)}`}
      linhaExpandida={(c) => <TurmasDoCurso c={c} />}
      corpoVazio={
        <tr>
          <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
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
            rotulo: "Turmas",
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
    </>
  );
}
