"use client";

import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { ComparativoTabelaCampus, type LinhaComparativoCampus } from "./ComparativoTabelaCampus";

export interface LinhaComparativo {
  sigla: string;
  nome: string;
  a: number;
  b: number;
  variacao: number;
  participacaoA: number | null;
  participacaoB: number | null;
  posicaoB: number | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop; por isso `variacaoRede`/`anoA`/`anoB`
 * chegam como dado simples, não fechados numa função vinda do servidor.
 */
export function ComparativoTabela({
  linhas,
  anoA,
  anoB,
  variacaoRede,
  destaqueSigla,
  totalA,
  totalB,
  camposPorSigla,
}: {
  linhas: LinhaComparativo[];
  anoA: number;
  anoB: number;
  bloco: string;
  variacaoRede: number;
  destaqueSigla: string;
  totalA: number;
  totalB: number;
  /** Câmpus de cada instituição, para o "+/-" em frente à sigla (nível 1). */
  camposPorSigla: Record<string, LinhaComparativoCampus[]>;
}) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.sigla}
      linhaClasse={(l) => (l.sigla === destaqueSigla ? "bg-if-green/5 font-medium" : "")}
      linhaExpandida={(l) => {
        const campi = camposPorSigla[l.sigla];
        if (!campi || campi.length === 0) return null;
        return <ComparativoTabelaCampus linhas={campi} anoA={anoA} anoB={anoB} />;
      }}
      colunas={
        [
          {
            chave: "instituicao",
            rotulo: "Instituição",
            valor: (l) => l.sigla,
            render: (l) => (
              <span>
                <span className="font-medium">{l.sigla}</span>
                <span className="ml-2 text-xs text-neutral-500">{l.nome}</span>
              </span>
            ),
          },
          {
            chave: "anoA",
            rotulo: String(anoA),
            alinhamento: "right",
            valor: (l) => (l.a === 0 && l.b > 0 ? null : l.a),
            render: (l) => (
              <span className="text-neutral-600 dark:text-neutral-400">
                {l.a === 0 && l.b > 0 ? "-" : reais.format(l.a)}
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
                <span className={l.variacao >= variacaoRede ? "text-if-green" : "text-if-red dark:text-red-400"}>
                  {l.variacao >= 0 ? "+" : ""}
                  {doisDecimais.format(l.variacao)}%
                </span>
              ),
          },
          {
            chave: "participacao",
            rotulo: `Fatia ${anoB}`,
            alinhamento: "right",
            valor: (l) => l.participacaoB,
            render: (l) => (
              <span className="text-neutral-600 dark:text-neutral-400">
                {l.participacaoB !== null ? `${doisDecimais.format(l.participacaoB)}%` : "-"}
              </span>
            ),
          },
          {
            chave: "posicao",
            rotulo: "Posição",
            alinhamento: "right",
            valor: (l) => l.posicaoB,
            render: (l) => <span className="text-neutral-600 dark:text-neutral-400">{l.posicaoB ?? "-"}</span>,
          },
        ] satisfies ColunaOrdenavel<LinhaComparativo>[]
      }
      rodape={
        <tfoot>
          <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
            <td className="px-2 py-2.5" />
            <td className="px-4 py-2.5">Rede, {linhas.length} instituições</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(totalA)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(totalB)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {variacaoRede >= 0 ? "+" : ""}
              {doisDecimais.format(variacaoRede)}%
            </td>
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5" />
          </tr>
        </tfoot>
      }
    />
  );
}
