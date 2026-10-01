import Link from "next/link";

/** As duas partes da extração manual da PNP, lado a lado no topo de cada tela. */
export function AbasPnp({ ativa }: { ativa: "ensino" | "orcamento" }) {
  const itens = [
    { chave: "ensino", href: "/pnp", rotulo: "Ensino e pessoal" },
    { chave: "orcamento", href: "/pnp/orcamento", rotulo: "Dados Orçamentários" },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 pb-3 dark:border-neutral-800">
      {itens.map((i) => (
        <Link
          key={i.chave}
          href={i.href}
          aria-current={i.chave === ativa ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            i.chave === ativa
              ? "bg-if-green text-white"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          }`}
        >
          {i.rotulo}
        </Link>
      ))}
      <span className="ml-2 inline-flex items-center rounded border border-sky-400/60 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
        PNP - Extração manual
      </span>
    </div>
  );
}
