"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";

export interface ColunaOrdenavel<T> {
  chave: string;
  rotulo: ReactNode;
  /** Valor usado para ordenar. Números ordenam numericamente; o resto vira texto (pt-BR). */
  valor: (linha: T) => string | number | null;
  /** Como a célula aparece. Sem isso, mostra `valor(linha)` cru. */
  render?: (linha: T) => ReactNode;
  alinhamento?: "left" | "right";
  /** `false` para uma coluna sem sentido de ordenar (ex.: uma barra visual). */
  ordenavel?: boolean;
  className?: string;
}

/**
 * Tabela com cabeçalho clicável: primeiro clique ordena crescente (seta para baixo),
 * segundo clique no mesmo título inverte para decrescente (seta para cima), e um
 * terceiro volta à ordem original de `linhas` — pedido do usuário, que queria comparar
 * câmpus e cursos sem reabrir a tela. A ordenação é só de exibição, client-side; quem
 * decide o que aparece em cada célula continua sendo o `render` de cada coluna.
 */
export function TabelaOrdenavel<T>({
  linhas,
  colunas,
  chaveLinha,
  className,
  linhaClasse,
  rodape,
  corpoVazio,
  cabecalhoFixo,
  linhaExpandida,
}: {
  linhas: T[];
  colunas: ColunaOrdenavel<T>[];
  chaveLinha: (linha: T) => string | number;
  className?: string;
  linhaClasse?: (linha: T) => string;
  rodape?: ReactNode;
  corpoVazio?: ReactNode;
  /** Para tabelas longas dentro de um contêiner com rolagem própria. */
  cabecalhoFixo?: boolean;
  /**
   * Conteúdo do "+/-" em frente à linha (pedido do usuário, versão antiga do
   * Matriz): quando presente, cada linha ganha uma coluna de expandir/recolher à
   * esquerda. Retornar `null`/`undefined` para uma linha específica esconde o botão
   * dela (linha sem nada para detalhar). Várias linhas podem ficar abertas ao mesmo
   * tempo, cada uma independente das outras.
   */
  linhaExpandida?: (linha: T) => ReactNode | null | undefined;
}) {
  const [ordenacao, setOrdenacao] = useState<{ chave: string; direcao: "asc" | "desc" } | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string | number>>(new Set());

  function alternarExpandida(chave: string | number) {
    setExpandidas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  const linhasOrdenadas = useMemo(() => {
    if (!ordenacao) return linhas;
    const coluna = colunas.find((c) => c.chave === ordenacao.chave);
    if (!coluna) return linhas;
    const sinal = ordenacao.direcao === "asc" ? 1 : -1;
    return [...linhas].sort((a, b) => {
      const va = coluna.valor(a);
      const vb = coluna.valor(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sinal;
      return String(va).localeCompare(String(vb), "pt-BR") * sinal;
    });
  }, [linhas, ordenacao, colunas]);

  function alternar(chave: string) {
    setOrdenacao((atual) => {
      if (atual?.chave !== chave) return { chave, direcao: "asc" };
      if (atual.direcao === "asc") return { chave, direcao: "desc" };
      return null;
    });
  }

  return (
    <table className={className ?? "w-full text-sm"}>
      <thead
        // `top-16` gruda logo abaixo do cabeçalho do site, que agora também é fixo
        // (`sticky top-0 z-30` em `SiteHeader`); `top-0` aqui ficaria por baixo dele.
        className={`bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400 ${cabecalhoFixo ? "sticky top-16 z-10" : ""}`}
      >
        <tr>
          {linhaExpandida && <th className="w-8 px-2 py-2.5" aria-hidden />}
          {colunas.map((c) => {
            const ativa = ordenacao?.chave === c.chave;
            const alinhaDireita = c.alinhamento === "right";
            return (
              <th
                key={c.chave}
                className={`px-4 py-2.5 font-medium ${alinhaDireita ? "text-right" : "text-left"} ${c.className ?? ""}`}
              >
                {c.ordenavel === false ? (
                  c.rotulo
                ) : (
                  <button
                    type="button"
                    onClick={() => alternar(c.chave)}
                    className={`inline-flex items-center gap-1 normal-case hover:text-neutral-900 dark:hover:text-neutral-100 ${
                      alinhaDireita ? "flex-row-reverse" : ""
                    }`}
                  >
                    {c.rotulo}
                    <span aria-hidden className={`text-[10px] ${ativa ? "" : "opacity-0"}`}>
                      {ativa && ordenacao.direcao === "asc" ? "▼" : "▲"}
                    </span>
                  </button>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {linhasOrdenadas.length === 0 && corpoVazio}
        {linhasOrdenadas.map((linha) => {
          const chave = chaveLinha(linha);
          const conteudoExpandido = linhaExpandida?.(linha);
          const aberta = expandidas.has(chave);
          return (
            <Fragment key={chave}>
              <tr
                className={`border-t border-neutral-200 dark:border-neutral-800 ${linhaClasse?.(linha) ?? ""}`}
              >
                {linhaExpandida && (
                  <td className="px-2 py-2.5 text-center">
                    {conteudoExpandido != null && (
                      <button
                        type="button"
                        onClick={() => alternarExpandida(chave)}
                        aria-expanded={aberta}
                        aria-label={aberta ? "Recolher" : "Expandir"}
                        className="inline-flex h-5 w-5 items-center justify-center rounded border border-neutral-300 text-xs font-semibold leading-none text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        {aberta ? "−" : "+"}
                      </button>
                    )}
                  </td>
                )}
                {colunas.map((c) => (
                  <td
                    key={c.chave}
                    className={`px-4 py-2.5 ${c.alinhamento === "right" ? "text-right tabular-nums" : ""}`}
                  >
                    {c.render ? c.render(linha) : (c.valor(linha) ?? "-")}
                  </td>
                ))}
              </tr>
              {aberta && conteudoExpandido != null && (
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td colSpan={colunas.length + 1} className="bg-neutral-50 p-3 dark:bg-neutral-900/40">
                    {conteudoExpandido}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
      {rodape}
    </table>
  );
}
