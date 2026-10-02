"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

interface Ajustes {
  /** Quantos blocos de seleção por linha (4, 2 ou 1). */
  colunas: 4 | 2 | 1;
  /** Altura da lista de cursos, em rem. */
  altura: number;
  /** Tamanho da letra da lista de cursos, em px. */
  fonte: number;
}

const PADRAO: Ajustes = { colunas: 4, altura: 11, fonte: 14 };
const LIMITES = { altura: { min: 6, max: 44, passo: 4 }, fonte: { min: 12, max: 24, passo: 2 } };
const CHAVE = "matriz-comparar-ajustes";

const GRADE: Record<Ajustes["colunas"], string> = {
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  2: "grid-cols-1 lg:grid-cols-2",
  1: "grid-cols-1",
};

function valido(a: Partial<Ajustes> | null): Ajustes {
  const colunas = a?.colunas === 2 || a?.colunas === 1 || a?.colunas === 4 ? a.colunas : PADRAO.colunas;
  const altura = Math.min(LIMITES.altura.max, Math.max(LIMITES.altura.min, Number(a?.altura) || PADRAO.altura));
  const fonte = Math.min(LIMITES.fonte.max, Math.max(LIMITES.fonte.min, Number(a?.fonte) || PADRAO.fonte));
  return { colunas, altura, fonte };
}

/**
 * Deixa quem usa a tela ajustar, na hora, o tamanho da seleção dos cursos: a altura e a letra da lista, e quantos blocos
 * cabem por linha (um bloco por linha dá a largura toda para ler o nome do curso). O ajuste vale para os blocos que
 * estão dentro (por variáveis de CSS) e fica guardado no navegador, para a próxima vez.
 */
export function AjustesDaSelecao({ children }: { children: ReactNode }) {
  const [ajustes, setAjustes] = useState<Ajustes>(PADRAO);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CHAVE);
      if (guardado) setAjustes(valido(JSON.parse(guardado) as Partial<Ajustes>));
    } catch {
      /* sem armazenamento: fica no padrão */
    }
  }, []);

  function mudar(proximo: Partial<Ajustes>) {
    const novo = valido({ ...ajustes, ...proximo });
    setAjustes(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      /* idem */
    }
  }

  const botao = "rounded-md border border-neutral-300 px-2.5 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";
  const estilo = { "--lista-altura": `${ajustes.altura}rem`, "--lista-fonte": `${ajustes.fonte}px` } as CSSProperties;

  return (
    <div className="flex flex-col gap-3" style={estilo}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Tamanho da seleção</span>
        <span className="flex items-center gap-1" title="Altura da lista de cursos">
          Altura
          <button type="button" className={botao} onClick={() => mudar({ altura: ajustes.altura - LIMITES.altura.passo })} disabled={ajustes.altura <= LIMITES.altura.min} aria-label="Diminuir a altura da lista">
            −
          </button>
          <button type="button" className={botao} onClick={() => mudar({ altura: ajustes.altura + LIMITES.altura.passo })} disabled={ajustes.altura >= LIMITES.altura.max} aria-label="Aumentar a altura da lista">
            +
          </button>
        </span>
        <span className="flex items-center gap-1" title="Tamanho da letra da lista de cursos">
          Letra
          <button type="button" className={botao} onClick={() => mudar({ fonte: ajustes.fonte - LIMITES.fonte.passo })} disabled={ajustes.fonte <= LIMITES.fonte.min} aria-label="Diminuir a letra">
            A−
          </button>
          <button type="button" className={botao} onClick={() => mudar({ fonte: ajustes.fonte + LIMITES.fonte.passo })} disabled={ajustes.fonte >= LIMITES.fonte.max} aria-label="Aumentar a letra">
            A+
          </button>
        </span>
        <span className="flex items-center gap-1" title="Quantos blocos de seleção por linha">
          Blocos por linha
          {([4, 2, 1] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => mudar({ colunas: n })}
              aria-pressed={ajustes.colunas === n}
              className={`${botao} ${ajustes.colunas === n ? "border-if-green bg-if-green text-white hover:bg-if-green dark:border-if-green dark:text-white" : ""}`}
            >
              {n}
            </button>
          ))}
        </span>
        <button type="button" onClick={() => mudar(PADRAO)} className="text-xs text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200">
          restaurar
        </button>
      </div>
      <div className={`grid gap-4 ${GRADE[ajustes.colunas]}`}>{children}</div>
    </div>
  );
}
