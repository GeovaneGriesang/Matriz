"use client";

import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface CampusLinha {
  unidadeId: number;
  nome: string;
  ciclos: number;
  valor: number;
  perda: number;
  matricula: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop. O link de cada câmpus é remontado aqui
 * a partir de `ano`/`sigla` (dados simples), em vez de receber a função `href` da
 * página — que também não atravessaria essa fronteira.
 */
export function ConsultaTabelaCampus({
  linhas,
  campusEscolhido,
  ano,
  sigla,
  instituicaoSigla,
  totalCiclos,
  totalValor,
  totalPerda,
  totalMatricula,
}: {
  linhas: CampusLinha[];
  campusEscolhido: number | null;
  ano: number;
  sigla: string;
  instituicaoSigla: string;
  totalCiclos: number;
  totalValor: number;
  totalPerda: number;
  totalMatricula: number;
}) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.unidadeId}
      linhaClasse={(l) => (l.unidadeId === campusEscolhido ? "bg-if-green/5" : "")}
      colunas={
        [
          {
            chave: "nome",
            rotulo: "Câmpus",
            valor: (l) => l.nome,
            render: (l) => (
              <Link
                href={`/consulta?ano=${ano}&instituicao=${encodeURIComponent(sigla)}&campus=${l.unidadeId}`}
                className="hover:underline"
              >
                {l.nome}
              </Link>
            ),
          },
          {
            chave: "ciclos",
            rotulo: "Ciclos",
            alinhamento: "right",
            valor: (l) => l.ciclos,
            render: (l) => <span className="text-neutral-600 dark:text-neutral-400">{numero.format(l.ciclos)}</span>,
          },
          {
            chave: "matricula",
            rotulo: "Matrícula",
            alinhamento: "right",
            valor: (l) => l.matricula,
            render: (l) => <span className="text-neutral-600 dark:text-neutral-400">{numero.format(l.matricula)}</span>,
          },
          {
            chave: "valor",
            rotulo: "Recebido",
            alinhamento: "right",
            valor: (l) => l.valor,
            render: (l) => <span className="font-medium">{reais.format(l.valor)}</span>,
          },
          {
            chave: "perda",
            rotulo: "Perda por evasão",
            alinhamento: "right",
            valor: (l) => l.perda,
            render: (l) => <span className="text-if-red dark:text-red-400">{reais.format(l.perda)}</span>,
          },
        ] satisfies ColunaOrdenavel<CampusLinha>[]
      }
      rodape={
        <tfoot>
          <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold dark:border-neutral-700 dark:bg-neutral-900">
            <td className="px-4 py-2.5">
              {instituicaoSigla}, {linhas.length} câmpus
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{numero.format(totalCiclos)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{numero.format(totalMatricula)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{reais.format(totalValor)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
              {reais.format(totalPerda)}
            </td>
          </tr>
        </tfoot>
      }
    />
  );
}
