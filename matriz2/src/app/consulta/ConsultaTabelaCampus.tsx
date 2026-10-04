"use client";

import { ehCampusDestaque } from "@/lib/destaque";
import Link from "next/link";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

export interface CampusLinha {
  unidadeId: number;
  nome: string;
  ciclos: number;
  valor: number;
  perda: number;
  matricula: number;
  recebidoReal: number | null;
  funcionamentoCalculado: number | null;
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
  totalFuncionamentoCalculado,
  comRecebido,
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
  totalRecebidoReal: number | null;
  totalFuncionamentoCalculado: number | null;
  /** O valor recebido (informado) existe só para o IFSul; nas outras instituições a coluna não aparece. */
  comRecebido: boolean;
}) {
  const totalValorComRecebido = linhas.filter((l) => l.recebidoReal !== null).reduce((a, l) => a + l.valor, 0);
  return (
    <TabelaOrdenavel
      linhas={linhas}
      chaveLinha={(l) => l.unidadeId}
      linhaDestaque={(l) => ehCampusDestaque(l.nome)}
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
            chave: "funcionamentoCalculado",
            rotulo: "Funcionamento calculado",
            alinhamento: "right",
            valor: (l) => l.funcionamentoCalculado,
            render: (l) =>
              l.funcionamentoCalculado !== null ? (
                <span className="text-neutral-600 dark:text-neutral-400">{reais.format(l.funcionamentoCalculado)}</span>
              ) : (
                <span className="text-xs text-neutral-400">não informado</span>
              ),
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
            <td className="px-4 py-2.5 text-right tabular-nums">
              {totalFuncionamentoCalculado !== null ? reais.format(totalFuncionamentoCalculado) : "não informado"}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-if-red dark:text-red-400">
              {reais.format(totalPerda)}
            </td>
          </tr>
        </tfoot>
      }
    />
  );
}
