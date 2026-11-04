"use client";

import { ehCampusDestaque } from "@/lib/destaque";
import Link from "next/link";
import type { ReactNode } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";
import { LegendaDaTabela } from "@/components/LegendaDaTabela";
import { exemploDeCampus, legendaConsultaCampus } from "@/components/legendas";

export interface CampusLinha {
  unidadeId: number;
  nome: string;
  ciclos: number;
  valor: number;
  perda: number;
  matricula: number;
  recebidoReal: number | null;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const doisDecimais = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Quanto o câmpus recebeu a mais (ou a menos) do que a matriz gerou: recebido menos gerado, e a proporção sobre o gerado. null sem valor recebido. */
function variacaoRecebido(valor: number, recebido: number | null): { absoluta: number; percentual: number | null } | null {
  if (recebido === null) return null;
  const absoluta = recebido - valor;
  return { absoluta, percentual: valor !== 0 ? absoluta / valor : null };
}

/** "+R$ 1.234" com a porcentagem embaixo; verde se recebeu mais, vermelho se recebeu menos (quase zero fica cinza). */
function CelulaVariacao({ v }: { v: { absoluta: number; percentual: number | null } | null }) {
  if (v === null) return <span className="text-xs text-neutral-400">-</span>;
  const classe = Math.abs(v.absoluta) < 1 ? "text-neutral-500" : v.absoluta > 0 ? "text-if-green" : "text-if-red dark:text-red-400";
  const sinal = v.absoluta >= 0 ? "+" : "-";
  return (
    <span className={classe}>
      {sinal}
      {reais.format(Math.abs(v.absoluta))}
      {v.percentual !== null && (
        <span className="block text-xs">
          {v.absoluta >= 0 ? "+" : ""}
          {doisDecimais.format(v.percentual * 100)}%
        </span>
      )}
    </span>
  );
}

/**
 * Client Component só para hospedar `colunas` (com funções `valor`/`render`):
 * `TabelaOrdenavel` é "use client", e uma função não atravessa a fronteira de
 * Server para Client Component como prop. O link de cada câmpus é remontado aqui
 * a partir de `ano`/`sigla` (dados simples), em vez de receber a função `href` da
 * página, que também não atravessaria essa fronteira.
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
  totalRecebidoReal,
  comRecebido,
  detalheDoCampus,
}: {
  /** O quadro com os cursos do câmpus escolhido, montado no servidor e aberto logo abaixo da linha dele. */
  detalheDoCampus?: ReactNode;
  linhas: CampusLinha[];
  campusEscolhido: number | null;
  ano: number;
  sigla: string;
  instituicaoSigla: string;
  totalCiclos: number;
  totalValor: number;
  totalPerda: number;
  totalMatricula: number;
  totalRecebidoReal: number | null;
  /** O valor recebido (informado) existe só para o IFSul; nas outras instituições a coluna não aparece. */
  comRecebido: boolean;
}) {
  const totalValorComRecebido = linhas.filter((l) => l.recebidoReal !== null).reduce((a, l) => a + l.valor, 0);
  return (
    <>
      <LegendaDaTabela itens={legendaConsultaCampus(exemploDeCampus(linhas), comRecebido)} exemplo={exemploDeCampus(linhas)?.nome} />
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.unidadeId}
      linhaDestaque={(l) => ehCampusDestaque(l.nome)}
      linhaClasse={(l) => (l.unidadeId === campusEscolhido ? "bg-if-green/5" : "")}
      idDaLinha={(l) => `campus-${l.unidadeId}`}
      detalhe={campusEscolhido !== null && detalheDoCampus ? { chave: campusEscolhido, conteudo: detalheDoCampus } : null}
      colunas={
        [
          {
            chave: "nome",
            rotulo: "Câmpus",
            valor: (l) => l.nome,
            render: (l) => (
              <Link
                href={
                  l.unidadeId === campusEscolhido
                    ? `/consulta?ano=${ano}&instituicao=${encodeURIComponent(sigla)}#campus-${l.unidadeId}`
                    : `/consulta?ano=${ano}&instituicao=${encodeURIComponent(sigla)}&campus=${l.unidadeId}#campus-${l.unidadeId}`
                }
                aria-expanded={l.unidadeId === campusEscolhido}
                title={l.unidadeId === campusEscolhido ? `Fechar os cursos de ${l.nome}` : `Abrir os cursos de ${l.nome}, logo abaixo desta linha`}
                className={`inline-flex items-center gap-2 hover:text-if-green ${l.unidadeId === campusEscolhido ? "font-semibold" : ""}`}
              >
                <SinalMaisMenos aberto={l.unidadeId === campusEscolhido} />
                {l.nome}
              </Link>
            ),
          },
          {
            chave: "ciclos",
            rotulo: "Turmas",
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
            rotulo: "Gerado pela matriz",
            alinhamento: "right",
            valor: (l) => l.valor,
            render: (l) => <span className="font-medium">{reais.format(l.valor)}</span>,
          },
          ...(comRecebido
            ? [
                {
                  chave: "recebidoReal",
                  rotulo: "Recebido (real)",
                  alinhamento: "right" as const,
                  valor: (l: CampusLinha) => l.recebidoReal,
                  render: (l: CampusLinha) =>
                    l.recebidoReal !== null ? (
                      <span className="font-medium text-if-green">{reais.format(l.recebidoReal)}</span>
                    ) : (
                      <span className="text-xs text-neutral-400">não informado</span>
                    ),
                },
                {
                  chave: "variacaoRecebido",
                  rotulo: "Variação (recebido − gerado)",
                  alinhamento: "right" as const,
                  valor: (l: CampusLinha) => variacaoRecebido(l.valor, l.recebidoReal)?.absoluta ?? null,
                  render: (l: CampusLinha) => <CelulaVariacao v={variacaoRecebido(l.valor, l.recebidoReal)} />,
                },
              ]
            : []),
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
            {comRecebido && (
              <td className="px-4 py-2.5 text-right tabular-nums">
                {totalRecebidoReal !== null ? reais.format(totalRecebidoReal) : "não informado"}
              </td>
            )}
            {comRecebido && (
              <td className="px-4 py-2.5 text-right tabular-nums">
                <CelulaVariacao v={variacaoRecebido(totalValorComRecebido, totalRecebidoReal)} />
              </td>
            )}
            <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
              {reais.format(totalPerda)}
            </td>
          </tr>
        </tfoot>
      }
    />
    </>
  );
}
