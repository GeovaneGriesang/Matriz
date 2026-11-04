import type { ReactNode } from "react";

/**
 * A explicação de uma tela, num quadro fechado: uma frase no topo, depois o resultado, e o resto aqui (revisão de 2026-11-04). O sistema continua didático: a
 * explicação e o exemplo estão a um clique, sem empurrar os números para baixo.
 */
export function ComoLerEstaTela({ children, titulo = "Como ler esta tela" }: { children: ReactNode; titulo?: string }) {
  return (
    <details className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <summary className="font-medium text-neutral-700 dark:text-neutral-300">{titulo}</summary>
      <div className="mt-2 flex flex-col gap-2 text-neutral-600 dark:text-neutral-400">{children}</div>
    </details>
  );
}
