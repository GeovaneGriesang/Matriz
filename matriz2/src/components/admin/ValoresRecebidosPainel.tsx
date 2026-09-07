"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarValorRecebidoAction, excluirValorRecebidoAction } from "@/server/actions/valoresRecebidos";
import { TabelaOrdenavel, type ColunaOrdenavel } from "@/components/TabelaOrdenavel";

interface Instituicao {
  id: number;
  sigla: string;
  nome: string;
  unidades: { id: number; nome: string }[];
}

interface RegistroLinha {
  id: number;
  unidadeId: number;
  campus: string;
  instituicaoSigla: string;
  valorRecebido: number;
  observacao: string | null;
  registradoPorNome: string;
  atualizadoEm: string;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ValoresRecebidosPainel({
  ano,
  anosDisponiveis,
  instituicoes,
  registros,
}: {
  ano: number;
  anosDisponiveis: number[];
  instituicoes: Instituicao[];
  registros: RegistroLinha[];
}) {
  const router = useRouter();
  const [instituicaoId, setInstituicaoId] = useState<number>(instituicoes[0]?.id ?? 0);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState<number | null>(null);

  const instituicaoEscolhida = instituicoes.find((i) => i.id === instituicaoId) ?? instituicoes[0];

  const anos = useMemo(() => {
    const conjunto = new Set(anosDisponiveis);
    conjunto.add(ano);
    return Array.from(conjunto).sort((a, b) => b - a);
  }, [anosDisponiveis, ano]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    const formData = new FormData(event.currentTarget);
    const resultado = await salvarValorRecebidoAction(formData);
    setEnviando(false);
    if (!resultado.ok) {
      setErro(resultado.errorMessage ?? "Não foi possível salvar.");
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  async function handleExcluir(id: number) {
    setExcluindo(id);
    const resultado = await excluirValorRecebidoAction(id);
    setExcluindo(null);
    if (!resultado.ok) {
      setErro(resultado.errorMessage ?? "Não foi possível excluir.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Ciclo</span>
        <div className="flex gap-1">
          {anos.map((a) => (
            <Link
              key={a}
              href={`/admin/valores-recebidos?ano=${a}`}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                a === ano
                  ? "bg-if-green text-white"
                  : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
      >
        <input type="hidden" name="ano" value={ano} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Instituição</span>
            <select
              value={instituicaoId}
              onChange={(e) => setInstituicaoId(Number(e.target.value))}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {instituicoes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sigla}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Câmpus</span>
            <select
              name="unidadeId"
              required
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {instituicaoEscolhida?.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Valor recebido (R$)</span>
            <input
              name="valorRecebido"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0,00"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">Observação (opcional)</span>
            <input
              name="observacao"
              type="text"
              placeholder="Ex.: extrato do Tesouro Gerencial de 15/03"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>

        {erro && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
        )}

        <button
          type="submit"
          disabled={enviando || !instituicaoEscolhida?.unidades.length}
          className="w-fit rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Salvando..." : "Salvar"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Já informados em {ano} ({registros.length})
        </h2>
        {registros.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum valor informado ainda para este ciclo.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <TabelaOrdenavel
              linhas={registros}
              chaveLinha={(r) => r.id}
              colunas={
                [
                  {
                    chave: "campus",
                    rotulo: "Câmpus",
                    valor: (r) => r.campus,
                    render: (r) => (
                      <span>
                        <span className="font-medium">{r.campus}</span>
                        <span className="ml-2 text-xs text-neutral-500">{r.instituicaoSigla}</span>
                      </span>
                    ),
                  },
                  {
                    chave: "valor",
                    rotulo: "Valor recebido",
                    alinhamento: "right",
                    valor: (r) => r.valorRecebido,
                    render: (r) => <span className="font-medium">{reais.format(r.valorRecebido)}</span>,
                  },
                  {
                    chave: "observacao",
                    rotulo: "Observação",
                    valor: (r) => r.observacao,
                    render: (r) => <span className="text-neutral-600 dark:text-neutral-400">{r.observacao ?? "não informado"}</span>,
                  },
                  {
                    chave: "registradoPor",
                    rotulo: "Quem informou",
                    valor: (r) => r.registradoPorNome,
                    render: (r) => (
                      <span className="text-xs text-neutral-500">
                        {r.registradoPorNome}, {formatoData.format(new Date(r.atualizadoEm))}
                      </span>
                    ),
                  },
                  {
                    chave: "excluir",
                    rotulo: "",
                    ordenavel: false,
                    valor: () => null,
                    render: (r) => (
                      <button
                        type="button"
                        onClick={() => handleExcluir(r.id)}
                        disabled={excluindo === r.id}
                        className="text-xs text-neutral-500 underline hover:text-if-red disabled:opacity-50"
                      >
                        {excluindo === r.id ? "excluindo..." : "excluir"}
                      </button>
                    ),
                  },
                ] satisfies ColunaOrdenavel<RegistroLinha>[]
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
