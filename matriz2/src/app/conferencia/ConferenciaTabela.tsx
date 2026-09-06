"use client";

import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface InstituicaoConferida {
  sigla: string;
  nome: string;
  ieaOficial: number | null;
  ieaRecalc: number | null;
  rapPresencial: number;
  valorOficial: number;
  valorRecalc: number | null;
  diferenca: number | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`), pelo mesmo
 * motivo de sempre: `TabelaOrdenavel` é "use client" e não aceita função vinda de fora.
 */
export function ConferenciaTabela({ linhas, ano }: { linhas: InstituicaoConferida[]; ano: number }) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.sigla}
      colunas={
        [
          {
            chave: "sigla",
            rotulo: "Instituição",
            valor: (l) => l.sigla,
            render: (l) => (
              <Link href={`/conferencia?ano=${ano}&instituicao=${l.sigla}`} className="hover:underline">
                <span className="font-medium">{l.sigla}</span>
                <span className="ml-2 text-xs text-neutral-500">{l.nome}</span>
              </Link>
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
