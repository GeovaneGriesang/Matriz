"use client";

import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface InstituicaoLinha {
  sigla: string;
  nome: string;
  campus: number;
  matricula: number;
  valor: number;
  perda: number;
  recebidoReal: number | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/**
 * Visão macro (rede inteira): uma linha por instituição, clicável para abrir o
 * detalhamento por câmpus de cada uma. Client Component pelo mesmo motivo de
 * sempre: `TabelaOrdenavel` é "use client" e não aceita função vinda de fora.
 */
export function ConsultaTabelaInstituicoes({
  linhas,
  ano,
  totalRede,
}: {
  linhas: InstituicaoLinha[];
  ano: number;
  totalRede: number;
}) {
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
              <Link href={`/consulta?ano=${ano}&instituicao=${l.sigla}`} className="hover:underline">
                <span className="font-medium">{l.sigla}</span>
                <span className="ml-2 text-xs text-neutral-500">{l.nome}</span>
              </Link>
            ),
          },
          {
            chave: "campus",
            rotulo: "Câmpus",
            alinhamento: "right",
            valor: (l) => l.campus,
            render: (l) => <span className="text-neutral-600 dark:text-neutral-400">{numero.format(l.campus)}</span>,
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
            rotulo: "Gerado pela matriz",
            alinhamento: "right",
            valor: (l) => l.valor,
            render: (l) => <span className="font-medium">{reais.format(l.valor)}</span>,
          },
          {
            chave: "recebidoReal",
            rotulo: "Recebido (real)",
            alinhamento: "right",
            valor: (l) => l.recebidoReal,
            render: (l) =>
              l.recebidoReal !== null ? (
                <span className="font-medium text-if-green">{reais.format(l.recebidoReal)}</span>
              ) : (
                <span className="text-xs text-neutral-400">não informado</span>
              ),
          },
          {
            chave: "participacao",
            rotulo: "Fatia da rede",
            alinhamento: "right",
            valor: (l) => (totalRede > 0 ? (l.valor / totalRede) * 100 : null),
            render: (l) => (
              <span className="text-neutral-600 dark:text-neutral-400">
                {totalRede > 0 ? `${decimal.format((l.valor / totalRede) * 100)}%` : "não informado"}
              </span>
            ),
          },
          {
            chave: "perda",
            rotulo: "Perda por evasão",
            alinhamento: "right",
            valor: (l) => l.perda,
            render: (l) => <span className="text-if-red dark:text-red-400">{reais.format(l.perda)}</span>,
          },
        ] satisfies ColunaOrdenavel<InstituicaoLinha>[]
      }
    />
  );
}
