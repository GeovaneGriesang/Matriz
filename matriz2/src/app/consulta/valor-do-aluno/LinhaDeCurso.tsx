"use client";

import { useState, type ReactNode } from "react";

/**
 * Uma linha de curso que abre o detalhe (as turmas e a conta de cada uma) numa faixa de largura total logo abaixo dela, em vez de
 * dentro da primeira coluna: as turmas à esquerda, a conta de cada uma à direita e os totais do curso embaixo.
 */
export function LinhaDeCurso({ rotulo, celulas, detalhe, colunas }: { rotulo: string; celulas: ReactNode; detalhe: ReactNode; colunas: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <tbody className="border-t border-neutral-200 dark:border-neutral-800">
      <tr className={aberto ? "bg-if-green/5" : undefined}>
        <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
          <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex items-start gap-1.5 text-left hover:text-if-green">
            <span aria-hidden className="mt-0.5 inline-block w-3 text-xs text-neutral-500">
              {aberto ? "▼" : "▶"}
            </span>
            <span>{rotulo}</span>
          </button>
        </td>
        {/* Aberto, os totais do curso descem para baixo das turmas e da conta; a linha fica só com o nome. */}
        {aberto ? <td colSpan={colunas - 1} /> : celulas}
      </tr>
      {aberto && (
        <tr>
          <td colSpan={colunas} className="bg-neutral-50 px-3 pb-4 pt-2 dark:bg-neutral-900">
            {detalhe}
          </td>
        </tr>
      )}
    </tbody>
  );
}
