"use client";

import { useState, type ReactNode } from "react";
import { SinalMaisMenos } from "@/components/SinalMaisMenos";

/**
 * Uma linha de curso que abre o detalhe numa faixa de largura total logo abaixo dela, pelos sinais + e −. Em "Quanto vale um aluno", aberta, os totais descem para
 * baixo das turmas; `manterCelulas` deixa os números na linha, para quando o detalhe só lista as turmas.
 */
export function LinhaDeCurso({ rotulo, celulas, detalhe, colunas, manterCelulas }: { rotulo: string; celulas: ReactNode; detalhe: ReactNode; colunas: number; manterCelulas?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <tbody className="border-t border-neutral-200 dark:border-neutral-800">
      <tr className={aberto ? "bg-if-green/5" : undefined}>
        <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
          <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex items-start gap-2 text-left hover:text-if-green">
            <SinalMaisMenos aberto={aberto} />
            <span>{rotulo}</span>
          </button>
        </td>
        {aberto && !manterCelulas ? <td colSpan={colunas - 1} /> : celulas}
      </tr>
      {aberto && (
        <tr data-detalhe="1">
          <td colSpan={colunas} className="bg-neutral-50 px-3 pb-4 pt-2 dark:bg-neutral-900">
            {detalhe}
          </td>
        </tr>
      )}
    </tbody>
  );
}
