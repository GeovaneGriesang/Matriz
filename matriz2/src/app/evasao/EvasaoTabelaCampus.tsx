"use client";

import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface CampusLinha {
  unidadeId: number;
  nome: string;
  recebido: number;
  perda: number;
  taxa: number;
  /** Câmpus elegível ao Piso Mínimo e já travado nele (o cálculo por matrícula dá
   * menos que o piso). Reduzir a evasão não aumenta o que ele recebe, porque o
   * Funcionamento já está no piso, não no calculado. */
  estaNoPiso: boolean;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Barra que compara a taxa do câmpus com a média da rede, que é a marca vertical. */
function Barra({ taxa, referencia }: { taxa: number; referencia: number }) {
  const escala = Math.max(taxa, referencia) * 1.6 || 1;
  const largura = Math.min((taxa / escala) * 100, 100);
  const marca = Math.min((referencia / escala) * 100, 100);
  const acima = taxa > referencia;
  return (
    <div
      className="relative h-3 w-32 rounded-sm bg-neutral-100 dark:bg-neutral-800"
      title={`${doisDecimais.format(taxa)}% contra ${doisDecimais.format(referencia)}% da rede`}
    >
      <div className={`h-full rounded-sm ${acima ? "bg-if-red/70" : "bg-if-green/70"}`} style={{ width: `${largura}%` }} />
      <div className="absolute inset-y-0 w-px bg-neutral-500 dark:bg-neutral-400" style={{ left: `${marca}%` }} aria-hidden />
    </div>
  );
}

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop. O link de cada câmpus é remontado aqui
 * a partir de `ano`/`sigla` (dados simples), em vez de receber a função `href` da
 * página — que também não atravessaria essa fronteira.
 */
export function EvasaoTabelaCampus({
  linhas,
  campusId,
  redePct,
  ano,
  sigla,
  instituicaoSigla,
  totalRecebido,
  totalPerda,
  totalTaxa,
}: {
  linhas: CampusLinha[];
  campusId: number | null;
  redePct: number;
  ano: number;
  sigla: string;
  instituicaoSigla: string;
  totalRecebido: number;
  totalPerda: number;
  totalTaxa: number;
}) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(c) => c.unidadeId}
      linhaClasse={(c) => (c.unidadeId === campusId ? "bg-if-green/5" : "")}
      colunas={
        [
          {
            chave: "nome",
            rotulo: "Câmpus",
            valor: (c) => c.nome,
            render: (c) => (
              <Link
                href={`/evasao?ano=${ano}&instituicao=${encodeURIComponent(sigla)}&campus=${c.unidadeId}`}
                className="hover:underline"
              >
                {c.nome}
                {c.estaNoPiso && (
                  <span
                    className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    title="Câmpus travado no Piso Mínimo: reduzir a evasão pode não aumentar o valor recebido."
                  >
                    no piso
                  </span>
                )}
              </Link>
            ),
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
            render: (c) => `${doisDecimais.format(c.taxa)}%`,
          },
          {
            chave: "barra",
            rotulo: "Contra a rede",
            ordenavel: false,
            valor: () => null,
            render: (c) => <Barra taxa={c.taxa} referencia={redePct} />,
          },
        ] satisfies ColunaOrdenavel<CampusLinha>[]
      }
      rodape={
        <tfoot>
          <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
            <td className="px-4 py-2.5">{instituicaoSigla}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(totalRecebido)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
              {reais.format(totalPerda)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{doisDecimais.format(totalTaxa)}%</td>
            <td className="px-4 py-2.5" />
          </tr>
        </tfoot>
      }
    />
  );
}
