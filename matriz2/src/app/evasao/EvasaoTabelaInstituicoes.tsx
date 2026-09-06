"use client";

import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface InstituicaoLinha {
  sigla: string;
  nome: string;
  posicao: number;
  recebido: number;
  perda: number;
  taxa: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Visão macro (rede inteira): uma linha por instituição, clicável para abrir o
 * detalhamento por câmpus/curso de cada uma. Client Component pelo mesmo motivo de
 * sempre — `TabelaOrdenavel` é "use client" e não aceita função vinda de fora.
 */
export function EvasaoTabelaInstituicoes({
  linhas,
  ano,
  redePct,
}: {
  linhas: InstituicaoLinha[];
  ano: number;
  redePct: number;
}) {
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.sigla}
      colunas={
        [
          {
            chave: "posicao",
            rotulo: "Posição",
            alinhamento: "right",
            valor: (l) => l.posicao,
            render: (l) => <span className="text-neutral-500 dark:text-neutral-400">{l.posicao}º</span>,
          },
          {
            chave: "sigla",
            rotulo: "Instituição",
            valor: (l) => l.sigla,
            render: (l) => (
              <Link href={`/evasao?ano=${ano}&instituicao=${l.sigla}`} className="hover:underline">
                <span className="font-medium">{l.sigla}</span>
                <span className="ml-2 text-xs text-neutral-500">{l.nome}</span>
              </Link>
            ),
          },
          {
            chave: "recebido",
            rotulo: "Recebido",
            alinhamento: "right",
            valor: (l) => l.recebido,
            render: (l) => <span className="text-neutral-600 dark:text-neutral-400">{reais.format(l.recebido)}</span>,
          },
          {
            chave: "perda",
            rotulo: "Perda",
            alinhamento: "right",
            valor: (l) => l.perda,
            render: (l) => <span className="font-medium text-if-red dark:text-red-400">{reais.format(l.perda)}</span>,
          },
          {
            chave: "taxa",
            rotulo: "Taxa",
            alinhamento: "right",
            valor: (l) => l.taxa,
            render: (l) => (
              <span className={l.taxa > redePct ? "font-semibold text-if-red dark:text-red-400" : ""}>
                {doisDecimais.format(l.taxa)}%
              </span>
            ),
          },
        ] satisfies ColunaOrdenavel<InstituicaoLinha>[]
      }
    />
  );
}
