"use client";

import { ehInstituicaoDestaque } from "@/lib/destaque";
import Link from "next/link";
import type { ReactNode } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { LegendaDaTabela } from "@/components/LegendaDaTabela";
import { exemploDeInstituicao, legendaEvasao } from "@/components/legendas";

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
 * A rede inteira: uma linha por instituição, que abre os câmpus dela logo abaixo, pelo +. Client Component pelo mesmo motivo de
 * sempre — `TabelaOrdenavel` é "use client" e não aceita função vinda de fora.
 */
export function EvasaoTabelaInstituicoes({
  linhas,
  ano,
  redePct,
  aberta,
  detalhe,
}: {
  linhas: InstituicaoLinha[];
  ano: number;
  redePct: number;
  /** A instituição aberta, com o quadro dos câmpus dela logo abaixo da linha. */
  aberta: string | null;
  detalhe: ReactNode;
}) {
  return (
    <>
      <LegendaDaTabela itens={legendaEvasao(exemploDeInstituicao(linhas)?.sigla ?? "", exemploDeInstituicao(linhas), { posicao: exemploDeInstituicao(linhas)?.posicao ?? null })} exemplo={exemploDeInstituicao(linhas)?.sigla} />
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.sigla}
      linhaDestaque={(l) => ehInstituicaoDestaque(l.sigla)}
      idDaLinha={(l) => `instituicao-${l.sigla}`}
      detalhe={aberta && detalhe ? { chave: aberta, conteudo: detalhe } : null}
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
              <Link
                href={l.sigla === aberta ? `/evasao?ano=${ano}#instituicao-${l.sigla}` : `/evasao?ano=${ano}&instituicao=${l.sigla}#instituicao-${l.sigla}`}
                aria-expanded={l.sigla === aberta}
                className="inline-flex items-center gap-2 hover:text-if-green"
              >
                <SinalMaisMenos aberto={l.sigla === aberta} />
                <span className="font-medium">{l.sigla}</span>
                <span className="text-xs font-normal text-neutral-500">{l.nome}</span>
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
    </>
  );
}
