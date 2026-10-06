"use client";

import { useState } from "react";

/**
 * Um select que mostra, logo abaixo, a explicação da opção escolhida, e a troca na hora, antes de qualquer clique em "Mostrar". Usado onde
 * as opções são termos técnicos (a "Relação do órgão" da PNP: UO, UGE, TED), para a pessoa saber o que está escolhendo.
 */
export function SeletorComExplicacao({
  nome,
  opcoes,
  valorInicial,
  explicacoes,
  classeDoSelect,
}: {
  nome: string;
  opcoes: string[];
  valorInicial: string;
  /** Texto explicativo por opção; opção sem texto não mostra nada. */
  explicacoes: Record<string, string>;
  classeDoSelect: string;
}) {
  const [valor, setValor] = useState(valorInicial);
  return (
    <>
      <select name={nome} value={valor} onChange={(e) => setValor(e.target.value)} className={classeDoSelect}>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {explicacoes[valor] && <span className="text-xs text-neutral-600 dark:text-neutral-400">{explicacoes[valor]}</span>}
    </>
  );
}
