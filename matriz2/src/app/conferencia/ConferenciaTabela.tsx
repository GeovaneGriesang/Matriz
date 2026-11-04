"use client";

import { ehInstituicaoDestaque } from "@/lib/destaque";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface BlocoDaConferencia {
  titulo: string;
  linhas: { rotulo: string; oficial: string; recalculado?: string }[];
  /** Por que o bloco não pôde ser conferido nesta instituição. */
  aviso?: string;
}

export interface InstituicaoConferida {
  sigla: string;
  nome: string;
  ieaOficial: number | null;
  ieaRecalc: number | null;
  rapPresencial: number;
  valorOficial: number;
  valorRecalc: number | null;
  diferenca: number | null;
  /** A conta dos blocos IEA, RAP e IAPL, aberta pelo + da linha. */
  blocos: BlocoDaConferencia[];
  /** O Funcionamento de cada câmpus: o gerado pela matriz e o refeito pela matrícula. */
  funcionamento: BlocoDaConferencia | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A conta de uma instituição, no quadro logo abaixo da linha dela. */
function BlocoDaTabela({ b }: { b: BlocoDaConferencia }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{b.titulo}</h3>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm" data-sem-ferramentas>
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-400">Componente</th>
              <th className="px-4 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Oficial (MDO)</th>
              <th className="px-4 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">Recalculado</th>
            </tr>
          </thead>
          <tbody>
            {b.linhas.map((x) => (
              <tr key={x.rotulo} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{x.rotulo}</td>
                <td className="px-4 py-2 text-right tabular-nums">{x.oficial}</td>
                <td className="px-4 py-2 text-right tabular-nums">{x.recalculado ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.aviso && <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{b.aviso}</p>}
    </div>
  );
}

function DetalheDaInstituicao({ l }: { l: InstituicaoConferida }) {
  return (
    <div className="flex flex-col gap-4 rounded-md border-l-4 border-if-green bg-white p-4 font-normal dark:bg-neutral-950">
      {l.blocos.map((b) => (
        <BlocoDaTabela key={b.titulo} b={b} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-if-green/40 bg-if-green/5 p-3 text-sm">
        <span className="font-medium text-neutral-900 dark:text-neutral-100">Total Qualidade e Eficiência (IEA + RAP + IAPL)</span>
        <span className="tabular-nums">
          oficial {reais.format(l.valorOficial)}
          {l.valorRecalc !== null && (
            <>
              , recalculado {reais.format(l.valorRecalc)}, diferença{" "}
              <strong className={Math.abs(l.diferenca ?? 0) > 1 ? "text-if-red" : "text-if-green"}>{reais.format(l.diferenca ?? 0)}</strong>
            </>
          )}
        </span>
      </div>
      {l.funcionamento && <BlocoDaTabela b={l.funcionamento} />}
    </div>
  );
}

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`), pelo mesmo
 * motivo de sempre: `TabelaOrdenavel` é "use client" e não aceita função vinda de fora.
 */
export function ConferenciaTabela({ linhas, abertaDeInicio }: { linhas: InstituicaoConferida[]; abertaDeInicio?: string }) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.sigla}
      linhaDestaque={(l) => ehInstituicaoDestaque(l.sigla)}
      linhaExpandida={(l) => <DetalheDaInstituicao l={l} />}
      abertasDeInicio={abertaDeInicio ? [abertaDeInicio] : undefined}
      colunas={
        [
          {
            chave: "sigla",
            rotulo: "Instituição",
            valor: (l) => l.sigla,
            render: (l) => (
              <>
                <span className="font-medium">{l.sigla}</span>
                <span className="ml-2 text-xs text-neutral-500">{l.nome}</span>
              </>
            ),
          },
          {
            chave: "iea",
            rotulo: "IEA, oficial → recalculado",
            alinhamento: "right",
            valor: (l) => l.ieaOficial,
            render: (l) =>
              l.ieaOficial !== null && l.ieaRecalc !== null ? (
                <span className="text-neutral-600 dark:text-neutral-400">
                  {percentual.format(l.ieaOficial * 100)}% → {percentual.format(l.ieaRecalc * 100)}%
                </span>
              ) : (
                "não conferido"
              ),
          },
          {
            chave: "rap",
            rotulo: "RAP presencial",
            alinhamento: "right",
            valor: (l) => l.rapPresencial,
            render: (l) => <span className="text-neutral-600 dark:text-neutral-400">{decimal.format(l.rapPresencial)}</span>,
          },
          {
            chave: "valorOficial",
            rotulo: "Qualidade e Eficiência, oficial",
            alinhamento: "right",
            valor: (l) => l.valorOficial,
            render: (l) => reais.format(l.valorOficial),
          },
          {
            chave: "valorRecalc",
            rotulo: "Recalculado",
            alinhamento: "right",
            valor: (l) => l.valorRecalc,
            render: (l) => (l.valorRecalc !== null ? reais.format(l.valorRecalc) : "não conferido"),
          },
          {
            chave: "diferenca",
            rotulo: "Diferença",
            alinhamento: "right",
            valor: (l) => (l.diferenca !== null ? Math.abs(l.diferenca) : null),
            render: (l) =>
              l.diferenca !== null ? (
                <span className={Math.abs(l.diferenca) > 1 ? "font-medium text-if-red dark:text-red-400" : "text-if-green"}>
                  {reais.format(l.diferenca)}
                </span>
              ) : (
                "não conferido"
              ),
          },
        ] satisfies ColunaOrdenavel<InstituicaoConferida>[]
      }
    />
  );
}
