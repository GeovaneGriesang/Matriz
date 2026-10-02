"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/simulador", rotulo: "Evasão, RAP e IAPL" },
  { href: "/simulador/novo-curso", rotulo: "Curso novo, ano a ano" },
  { href: "/simulador/curso", rotulo: "Curso: 3 ou 4 anos" },
  { href: "/simulador/distribuicao", rotulo: "Distribuição entre câmpus" },
];

/** Abas das simulações, repetidas no topo de cada uma para não ser preciso voltar ao menu. */
export function SubmenuSimulador() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 border-b border-neutral-200 pb-3 dark:border-neutral-800">
      {ABAS.map((a) => {
        const ativa = pathname === a.href;
        return (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              ativa
                ? "bg-if-green text-white"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
