"use client";

import { useRouter } from "next/navigation";

/** Uma lista que abre o endereço da opção escolhida, mantendo a página onde está. */
export function SeletorQueNavega({ rotulo, valor, opcoes }: { rotulo: string; valor: string; opcoes: { valor: string; rotulo: string; href: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label={rotulo}
      value={valor}
      onChange={(e) => {
        const href = opcoes.find((o) => o.valor === e.target.value)?.href;
        if (href) router.push(href, { scroll: false });
      }}
      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    >
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
