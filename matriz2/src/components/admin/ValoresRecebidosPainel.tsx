"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  salvarValoresRecebidosEmLoteAction,
  excluirValorRecebidoAction,
  type OperacaoValorRecebido,
} from "@/server/actions/valoresRecebidos";
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
const reaisSemSimbolo = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * `input type="number"` não sabe mostrar "1.234,56" (vírgula decimal, ponto de
 * milhar): mostra sempre o número cru, com ponto, sem nenhum símbolo. Por isso o
 * campo de valor é `type="text"`, formatado ao perder o foco; o valor cru some
 * enquanto a pessoa digita, pra não brigar com o cursor a cada tecla.
 */
function formatarValorInput(numero: number): string {
  return reaisSemSimbolo.format(numero);
}

/** `null` = campo vazio, `NaN` = texto que não dá pra interpretar como número. */
function parseValorInput(texto: string): number | null {
  const bruto = texto.trim();
  if (bruto === "") return null;
  const normalizado = bruto.replace(/\./g, "").replace(",", ".");
  return Number(normalizado);
}

/**
 * Edita todos os câmpus de UMA instituição de uma vez (pedido do usuário: "não
 * quero fazer cada campus de cada vez, quero fazer de todos os campus de um IF por
 * vez"). Cada linha já vem preenchida com o valor atual, quando existe; salvar só
 * grava o que de fato mudou (comparado ao valor original), e limpar o campo apaga o
 * registro. `key` no formulário força um remount ao trocar de instituição ou de
 * ano, para os campos não-controlados (`defaultValue`) voltarem a refletir os dados
 * novos em vez de arrastar o que a pessoa tinha digitado antes.
 */
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
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<number | null>(null);

  const instituicaoEscolhida = instituicoes.find((i) => i.id === instituicaoId) ?? instituicoes[0];

  const anos = useMemo(() => {
    const conjunto = new Set(anosDisponiveis);
    conjunto.add(ano);
    return Array.from(conjunto).sort((a, b) => b - a);
  }, [anosDisponiveis, ano]);

  const registroPorUnidade = useMemo(() => {
    const mapa = new Map<number, RegistroLinha>();
    for (const r of registros) mapa.set(r.unidadeId, r);
    return mapa;
  }, [registros]);

  async function handleSubmitLote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setMensagem(null);
    if (!instituicaoEscolhida) return;

    const formData = new FormData(event.currentTarget);
    const operacoes: OperacaoValorRecebido[] = [];

    for (const u of instituicaoEscolhida.unidades) {
      const original = registroPorUnidade.get(u.id);
      const valorBruto = String(formData.get(`valor-${u.id}`) ?? "");
      const obsBruto = String(formData.get(`obs-${u.id}`) ?? "").trim();
      const valorNumero = parseValorInput(valorBruto);
      const obsOriginal = original?.observacao ?? "";

      // Comparação em centavos, não pela string: o campo mostra "716,82" formatado,
      // então comparar direto com `String(original.valorRecebido)` (que vem cru, com
      // ponto e às vezes mais casas decimais) sempre daria "mudou" mesmo sem ninguém
      // ter tocado no campo.
      const valorOriginalCentavos = original ? Math.round(original.valorRecebido * 100) : null;
      const valorNovoCentavos = valorNumero === null ? null : Math.round(valorNumero * 100);
      if (valorNovoCentavos === valorOriginalCentavos && obsBruto === obsOriginal) continue;

      if (valorNumero === null) {
        if (original) operacoes.push({ unidadeId: u.id, valorRecebido: null, observacao: null });
        continue;
      }

      if (!Number.isFinite(valorNumero) || valorNumero < 0) {
        setErro(`Valor inválido em "${u.nome}".`);
        return;
      }
      operacoes.push({ unidadeId: u.id, valorRecebido: valorNumero, observacao: obsBruto || null });
    }

    if (operacoes.length === 0) {
      setMensagem("Nada para salvar: nenhum valor foi alterado.");
      return;
    }

    setSalvando(true);
    const resultado = await salvarValoresRecebidosEmLoteAction(ano, operacoes);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.errorMessage ?? "Não foi possível salvar.");
      return;
    }
    setMensagem(
      `${operacoes.length} câmpus atualizado${operacoes.length > 1 ? "s" : ""} em ${instituicaoEscolhida.sigla}.`,
    );
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

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Instituição</span>
        <div className="flex flex-wrap gap-1">
          {instituicoes.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => {
                setInstituicaoId(i.id);
                setErro(null);
                setMensagem(null);
              }}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                i.id === instituicaoId
                  ? "bg-if-green text-white"
                  : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {i.sigla}
            </button>
          ))}
        </div>
      </div>

      {instituicaoEscolhida && (
        <form
          key={`${ano}-${instituicaoEscolhida.id}`}
          onSubmit={handleSubmitLote}
          className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
        >
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {instituicaoEscolhida.sigla}, todos os câmpus, {ano}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Preencha ou edite o valor de quantos câmpus quiser e salve tudo de uma vez. Deixar um campo
            em branco não grava nada; apagar o valor de um câmpus que já tinha registro remove esse
            registro ao salvar.
          </p>

          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Câmpus</th>
                  <th className="px-4 py-2.5 font-medium">Valor recebido (R$)</th>
                  <th className="px-4 py-2.5 font-medium">Observação</th>
                  <th className="px-4 py-2.5 font-medium">Última atualização</th>
                </tr>
              </thead>
              <tbody>
                {instituicaoEscolhida.unidades.map((u) => {
                  const original = registroPorUnidade.get(u.id);
                  return (
                    <tr key={u.id} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-4 py-2 font-medium text-neutral-900 dark:text-neutral-100">{u.nome}</td>
                      <td className="px-4 py-2">
                        <div className="flex w-40 items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 focus-within:ring-1 focus-within:ring-if-green dark:border-neutral-700 dark:bg-neutral-900">
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">R$</span>
                          <input
                            name={`valor-${u.id}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={original ? formatarValorInput(original.valorRecebido) : ""}
                            onBlur={(e) => {
                              const valor = parseValorInput(e.target.value);
                              if (valor !== null && Number.isFinite(valor) && valor >= 0) {
                                e.target.value = formatarValorInput(valor);
                              }
                            }}
                            placeholder="não informado"
                            className="w-full border-0 bg-transparent p-0 text-sm tabular-nums text-neutral-900 focus:outline-none focus:ring-0 dark:text-neutral-100"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          name={`obs-${u.id}`}
                          type="text"
                          defaultValue={original?.observacao ?? ""}
                          placeholder="opcional"
                          className="w-full min-w-48 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                        />
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                        {original ? `${original.registradoPorNome}, ${formatoData.format(new Date(original.atualizadoEm))}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {erro && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
          )}
          {mensagem && !erro && (
            <p className="rounded-md bg-if-green/10 p-3 text-sm text-if-green">{mensagem}</p>
          )}

          <button
            type="submit"
            disabled={salvando || !instituicaoEscolhida.unidades.length}
            className="w-fit rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? "Salvando..." : `Salvar alterações de ${instituicaoEscolhida.sigla}`}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Todos os valores já informados em {ano}, rede inteira ({registros.length})
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
