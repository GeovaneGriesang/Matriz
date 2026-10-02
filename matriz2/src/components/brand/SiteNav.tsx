"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GRUPOS_MENU, ITEM_COMO_FUNCIONA, ITEM_INICIO, itemAtivo } from "@/lib/menu";

/**
 * O menu em quatro grupos por pergunta (Consultar, Simular, Conferir, Dados), mais "Início" e "Como funciona". Antes
 * eram 11 links soltos, difíceis de distinguir; agora cada grupo abre uma lista em que cada tela traz uma frase dizendo
 * o que se faz nela. O texto vem de `lib/menu.ts`, o mesmo da página inicial.
 *
 * "use client" por causa do `usePathname` (marcar a tela aberta) e do estado de qual grupo está aberto. O resto do
 * cabeçalho (sessão, nome, Sair) continua no Server Component.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState<string | null>(null);
  const raiz = useRef<HTMLElement>(null);
  const ativo = itemAtivo(pathname);

  // Fecha ao trocar de tela, ao clicar fora e com Esc.
  useEffect(() => setAberto(null), [pathname]);
  useEffect(() => {
    function fora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(null);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(null);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const botao = (ligado: boolean) =>
    `inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium ${
      ligado ? "bg-if-green text-white" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
    }`;

  return (
    <nav ref={raiz} className="flex flex-wrap items-center gap-1">
      <Link href={ITEM_INICIO.href} aria-current={ativo?.href === "/" ? "page" : undefined} className={botao(ativo?.href === "/")}>
        {ITEM_INICIO.rotulo}
      </Link>

      {GRUPOS_MENU.map((g) => {
        const grupoAtivo = g.itens.some((i) => i.href === ativo?.href);
        const estaAberto = aberto === g.id;
        return (
          <div key={g.id} className="relative">
            <button
              type="button"
              onClick={() => setAberto(estaAberto ? null : g.id)}
              aria-expanded={estaAberto}
              aria-haspopup="true"
              className={botao(grupoAtivo)}
            >
              {g.rotulo}
              <span aria-hidden className="text-[10px]">
                {estaAberto ? "▲" : "▼"}
              </span>
            </button>
            {estaAberto && (
              <div className="absolute left-0 top-full z-40 mt-1 flex w-80 max-w-[90vw] flex-col gap-0.5 rounded-lg border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                {g.itens.map((i) => {
                  const esta = i.href === ativo?.href;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      aria-current={esta ? "page" : undefined}
                      className={`flex flex-col gap-0.5 rounded-md px-3 py-2 ${
                        esta ? "bg-if-green/10" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className={`text-sm font-medium ${esta ? "text-if-green dark:text-green-400" : "text-neutral-900 dark:text-neutral-100"}`}>
                        {i.rotulo}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">{i.descricao}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <Link
        href={ITEM_COMO_FUNCIONA.href}
        aria-current={ativo?.href === ITEM_COMO_FUNCIONA.href ? "page" : undefined}
        className={botao(ativo?.href === ITEM_COMO_FUNCIONA.href)}
      >
        {ITEM_COMO_FUNCIONA.rotulo}
      </Link>
    </nav>
  );
}
