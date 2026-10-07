"use client";

import { useEffect } from "react";

/** Uma janela por cima da página, fechada com Esc ou pelo botão. Não fecha ao clicar fora, para não perder o que a pessoa digitou. */
export function Modal({ titulo, aoFechar, children, largura = "max-w-lg" }: { titulo: string; aoFechar: () => void; children: React.ReactNode; largura?: string }) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return (
    <div className="nao-imprimir fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`flex max-h-[90vh] w-full ${largura} flex-col gap-4 overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-neutral-900`}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h2>
          <button type="button" onClick={aoFechar} className="rounded px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800" aria-label="Fechar">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
