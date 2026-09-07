"use client";

import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface LinhaComparativoCampus {
  unidadeId: number;
  nome: string;
  a: number;
  b: number;
  variacao: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`), pelo
 * mesmo motivo de sempre: `TabelaOrdenavel` é "use client".
 */
export function ComparativoTabelaCampus({
  linhas,
  anoA,
  anoB,
}: {
  linhas: LinhaComparativoCampus[];
  anoA: number;
  anoB: number;
}) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.unidadeId}
      colunas={
        [
          { chave: "nome", rotulo: "Câmpus", valor: (l) => l.nome },
          {
            chave: "anoA",
            rotulo: String(anoA),
            alinhamento: "right",
            valor: (l) => (l.a === 0 && l.b > 0 ? null : l.a),
            render: (l) => (
              <span className="text-neutral-600 dark:text-neutral-400">
                {l.a === 0 && l.b > 0 ? "não havia" : reais.format(l.a)}
              </span>
            ),
          },
          {
            chave: "anoB",
            rotulo: String(anoB),
            alinhamento: "right",
            valor: (l) => l.b,
            render: (l) => reais.format(l.b),
          },
          {
            chave: "variacao",
            rotulo: "Variação",
            alinhamento: "right",
            valor: (l) => (l.a === 0 && l.b > 0 ? null : l.variacao),
            render: (l) =>
              l.a === 0 && l.b > 0 ? (
                <span className="text-xs text-neutral-500">novo no ciclo</span>
              ) : (
                <span className={l.variacao >= 0 ? "text-if-green" : "text-if-red dark:text-red-400"}>
                  {l.variacao >= 0 ? "+" : ""}
                  {doisDecimais.format(l.variacao)}%
                </span>
              ),
          },
        ] satisfies ColunaOrdenavel<LinhaComparativoCampus>[]
      }
    />
  );
}
