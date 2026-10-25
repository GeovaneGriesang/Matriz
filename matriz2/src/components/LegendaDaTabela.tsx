"use client";

import { useState, type ReactNode } from "react";

export interface ItemDeLegenda {
  coluna: string;
  /** O que a coluna é e, quando há número, a conta com os valores da linha de exemplo. */
  texto: ReactNode;
}

/**
 * "Como ler esta tabela": um botão por coluna, com "?"; ao clicar, a explicação da coluna aparece logo abaixo, com a conta feita
 * com os números reais de uma linha da tabela. "Explicar todas" abre tudo de uma vez. Fica fora da tabela para não atrapalhar a
 * ordenação e sai na impressão quando está aberto.
 */
export function LegendaDaTabela({ itens, exemplo }: { itens: ItemDeLegenda[]; exemplo?: string }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  if (itens.length === 0) return null;
  const todas = abertas.size === itens.length;
  const alternar = (c: string) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="nao-imprimir flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-neutral-600 dark:text-neutral-400">Como ler esta tabela:</span>
        {itens.map((i) => {
          const aberta = abertas.has(i.coluna);
          return (
            <button
              key={i.coluna}
              type="button"
              onClick={() => alternar(i.coluna)}
              aria-expanded={aberta}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                aberta ? "border-if-green bg-if-green text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-if-green hover:text-if-green dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
              }`}
            >
              {i.coluna}
              <span aria-hidden className="font-bold">?</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setAbertas(todas ? new Set() : new Set(itens.map((i) => i.coluna)))} className="ml-1 font-medium text-if-green underline hover:no-underline dark:text-green-400">
          {todas ? "fechar explicações" : "explicar todas"}
        </button>
      </div>
      {abertas.size > 0 && (
        <dl className="flex flex-col gap-1.5 text-neutral-700 dark:text-neutral-300">
          {exemplo && <p className="text-neutral-500">Os números das contas são os de {exemplo}.</p>}
          {itens
            .filter((i) => abertas.has(i.coluna))
            .map((i) => (
              <div key={i.coluna}>
                <dt className="inline font-semibold text-neutral-900 dark:text-neutral-100">{i.coluna}: </dt>
                <dd className="inline">{i.texto}</dd>
              </div>
            ))}
        </dl>
      )}
    </div>
  );
}
