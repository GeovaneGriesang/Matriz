"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiUrl } from "@/lib/basePath";
import {
  importarComposicaoRepasseAction,
  type ImportarComposicaoRepasseResult,
} from "@/server/actions/composicaoRepasseAnual";
import type { ComposicaoRepasseResposta } from "@/app/api/composicao-repasse/route";

type Categoria = "PRESENCIAL" | "EAD" | "EAD_MOOC" | "EAD_FP";

/** Rótulo e explicação de cada categoria — fonte única para a tabela, o resumo e a legenda. */
const CATEGORIA_INFO: Record<Categoria, { rotulo: string; explicacao: string; classe: string }> = {
  PRESENCIAL: {
    rotulo: "Presencial",
    explicacao: "matrícula presencial, peso cheio — é a referência contra a qual as outras são medidas",
    classe: "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
  },
  EAD: {
    rotulo: "EAD",
    explicacao: "ensino a distância em programa com financiamento próprio da rede (E-TEC, UAB, MedioTec, PROEJA…)",
    classe: "bg-teal-200 text-teal-900 dark:bg-teal-900 dark:text-teal-100",
  },
  EAD_MOOC: {
    rotulo: "EAD MOOC",
    explicacao: "cursos abertos e massivos (Aprenda Mais) — os de menor peso, por serem de curta duração e livre acesso",
    classe: "bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-100",
  },
  EAD_FP: {
    rotulo: "EAD FP",
    explicacao: "a distância sem programa associado, custeado pela própria instituição — quase equivalente ao presencial",
    classe: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  },
};

const ORDEM_CATEGORIAS: Categoria[] = ["PRESENCIAL", "EAD_FP", "EAD", "EAD_MOOC"];

const formatoPeso = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function ComposicaoRepassePanel() {
  const anoCorrente = new Date().getFullYear();
  const [ano, setAno] = useState(anoCorrente + 1);
  const [dados, setDados] = useState<ComposicaoRepasseResposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ImportarComposicaoRepasseResult | null>(null);

  const carregar = useCallback((anoAlvo: number) => {
    setCarregando(true);
    fetch(apiUrl(`/api/composicao-repasse?ano=${anoAlvo}`))
      .then((r) => (r.ok ? (r.json() as Promise<ComposicaoRepasseResposta>) : null))
      .then((d) => setDados(d))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => carregar(ano), [ano, carregar]);

  /** Peso vigente por categoria: o que o cálculo efetivamente usa naquele ano. */
  const pesosVigentes = useMemo(() => {
    const mapa = new Map<Categoria, { peso: number; linhas: number; divergente: boolean }>();
    for (const l of dados?.linhas ?? []) {
      const cat = l.categoriaRepasse as Categoria;
      const atual = mapa.get(cat);
      if (atual === undefined) mapa.set(cat, { peso: l.peso, linhas: 1, divergente: false });
      else mapa.set(cat, { peso: l.peso, linhas: atual.linhas + 1, divergente: atual.divergente || atual.peso !== l.peso });
    }
    return mapa;
  }, [dados]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("ano", String(ano));
    setEnviando(true);
    setResultado(null);
    try {
      setResultado(await importarComposicaoRepasseAction(formData));
      carregar(ano);
    } catch (error) {
      setResultado({ ok: false, errorMessage: (error as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  const temCadastro = (dados?.linhas.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="ano" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Ano do orçamento
            </label>
            <input
              id="ano"
              type="number"
              min={2000}
              max={2100}
              value={ano}
              disabled={enviando}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-32 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="arquivo" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Planilha da Composição de Repasse (.xlsx ou .csv)
            </label>
            <input
              id="arquivo"
              name="arquivo"
              type="file"
              accept=".csv,.xlsx"
              required
              disabled={enviando}
              className="text-sm text-neutral-700 dark:text-neutral-300"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {enviando ? "Importando..." : "Importar"}
          </button>
        </div>
        <div className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
          <p>
            Envie o <strong>.xlsx da CONIF direto</strong>, sem converter nada — ou um .csv, se preferir. As
            quatro colunas necessárias são <em>Modalidade</em>, <em>Fonte de Financiamento</em>,{" "}
            <em>Repasse</em> e <em>Porcentagem</em>; o sistema as localiza pelo nome, então a ordem das colunas
            e uma eventual linha de título antes do cabeçalho não atrapalham.
          </p>
          <p>
            A coluna <em>Porcentagem</em> aceita fração (0,25), percentual (25%) ou número inteiro (25) — todos
            viram o mesmo peso. A importação <strong>substitui</strong> a composição daquele ano.
          </p>
        </div>
      </form>

      {resultado && (
        <div
          className={`rounded-md p-4 text-sm ${
            resultado.ok
              ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
              : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {resultado.ok ? (
            <>
              <p>
                {(resultado.importadas ?? 0) + (resultado.atualizadas ?? 0)} linha(s) gravada(s) para {ano}
                {(resultado.removidas ?? 0) > 0 && <> (substituindo {resultado.removidas} linha(s) anterior(es))</>}.
              </p>
              {(resultado.categoriasInconsistentes?.length ?? 0) > 0 && (
                <p className="mt-1 font-medium">
                  Atenção: há pesos diferentes dentro da mesma categoria em{" "}
                  {resultado.categoriasInconsistentes!.join(", ")}. Na planilha oficial todas as linhas de uma
                  categoria têm o mesmo peso — confira o arquivo.
                </p>
              )}
            </>
          ) : (
            <p>Erro: {resultado.errorMessage}</p>
          )}
          {resultado.naoImportadas && resultado.naoImportadas.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {resultado.naoImportadas.map((l, i) => (
                <li key={i}>
                  Linha {l.linha} ({l.modalidade} / {l.fonte}): {l.detalhe ?? l.motivo.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          Pesos que o cálculo usa em {ano}
        </h2>

        {carregando ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Carregando…</p>
        ) : !temCadastro ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Nenhuma composição cadastrada para {ano}. Um cálculo deste ano usará os pesos padrão da CONIF
            (Presencial 1 · EAD 0,25 · EAD MOOC <strong>0,08</strong> · EAD FP 0,8) e{" "}
            <strong>avisará na memória de cálculo</strong>. Esses pesos são os mesmos nos ciclos 2026 e 2027,
            então há boa chance de estarem certos — mas só o arquivo daquele ano confirma.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {ORDEM_CATEGORIAS.filter((c) => pesosVigentes.has(c)).map((c) => {
                const info = pesosVigentes.get(c)!;
                return (
                  <div
                    key={c}
                    className="flex min-w-40 flex-col gap-1 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <span className={`w-fit rounded px-1.5 py-0.5 text-xs ${CATEGORIA_INFO[c].classe}`}>
                      {CATEGORIA_INFO[c].rotulo}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {formatoPeso.format(info.peso)}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {info.linhas} programa(s)
                      {info.divergente && <strong className="text-red-600 dark:text-red-400"> · pesos divergentes</strong>}
                    </span>
                  </div>
                );
              })}
            </div>

            <ul className="space-y-0.5 text-xs text-neutral-700 dark:text-neutral-300">
              {ORDEM_CATEGORIAS.filter((c) => pesosVigentes.has(c)).map((c) => (
                <li key={c}>
                  <span className={`rounded px-1.5 py-0.5 ${CATEGORIA_INFO[c].classe}`}>
                    {CATEGORIA_INFO[c].rotulo}
                  </span>{" "}
                  — {CATEGORIA_INFO[c].explicacao}.
                </li>
              ))}
            </ul>

            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Ver a classificação completa ({dados!.linhas.length} programas)
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800">
                      <th className="py-1 pr-3 font-medium">Modalidade</th>
                      <th className="py-1 pr-3 font-medium">Fonte de financiamento</th>
                      <th className="py-1 pr-3 font-medium">Categoria</th>
                      <th className="py-1 text-right font-medium">Peso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados!.linhas.map((l) => (
                      <tr key={l.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                        <td className="py-1 pr-3">{l.modalidadeEnsino}</td>
                        <td className="py-1 pr-3">{l.fonteFinanciamento}</td>
                        <td className="py-1 pr-3">
                          <span className={`rounded px-1.5 py-0.5 ${CATEGORIA_INFO[l.categoriaRepasse as Categoria].classe}`}>
                            {CATEGORIA_INFO[l.categoriaRepasse as Categoria].rotulo}
                          </span>
                        </td>
                        <td className="py-1 text-right tabular-nums">{formatoPeso.format(l.peso)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}

        {(dados?.anosDisponiveis.length ?? 0) > 0 && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Anos já cadastrados: {dados!.anosDisponiveis.join(", ")}.
          </p>
        )}
      </div>
    </div>
  );
}
