import Link from "next/link";
import { CONFIANCA, NIVEIS, nivelDaTela, type IdConfianca, type ItemConfianca } from "@/lib/confianca";
import { PROSE_LINK } from "@/lib/layoutWidths";

/** A etiqueta de confiança de um item, que se abre para mostrar o porquê. Sem JavaScript: é um `<details>`. */
export function SeloConfianca({ id }: { id: IdConfianca }) {
  const item: ItemConfianca = CONFIANCA[id];
  const nivel = NIVEIS[item.nivel];
  return (
    <details className="group max-w-full">
      <summary
        className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${nivel.classes}`}
        title={nivel.descricao}
      >
        <span aria-hidden className="font-bold">
          {nivel.icone}
        </span>
        <span>{nivel.rotulo}:</span>
        <span className="font-normal">{item.titulo}</span>
      </summary>
      <div className={`mt-1 flex flex-col gap-1 rounded-md border p-3 text-sm ${nivel.classes}`}>
        <p className="text-neutral-800 dark:text-neutral-200">{item.porque}</p>
        {item.paraResolver && (
          <p className="text-neutral-800 dark:text-neutral-200">
            <strong>Para resolver:</strong> {item.paraResolver}
          </p>
        )}
      </div>
    </details>
  );
}

/**
 * Um selo só no topo da tela, com o nível de menor certeza entre os itens dela (revisão de 2026-11-04: os vários selos ocupavam o topo). O + abre o
 * porquê de cada item.
 */
export function PainelConfianca({ ids }: { ids: IdConfianca[] }) {
  if (ids.length === 0) return null;
  const itens: ItemConfianca[] = ids.map((id) => CONFIANCA[id]);
  const nivel = NIVEIS[nivelDaTela(itens.map((i) => i.nivel))];
  return (
    <details className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
      <summary className="text-sm text-neutral-700 dark:text-neutral-300">
        Confiança dos números desta tela:{" "}
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${nivel.classes}`} title={nivel.descricao}>
          <span aria-hidden className="font-bold">
            {nivel.icone}
          </span>
          {nivel.rotulo}
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <p className="text-neutral-600 dark:text-neutral-400">
          O selo mostra o item de menor certeza desta tela. {nivel.rotulo}: {nivel.descricao} Exemplo: em &quot;{itens[0]!.titulo}&quot;, o nível é {NIVEIS[itens[0]!.nivel].rotulo.toLowerCase()}.
        </p>
        <ul className="flex flex-col gap-2">
          {itens.map((item) => (
            <li key={item.titulo} className="flex flex-col gap-1">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {NIVEIS[item.nivel].rotulo}: {item.titulo}
              </span>
              <span className="text-neutral-700 dark:text-neutral-300">{item.porque}</span>
              {item.paraResolver && (
                <span className="text-neutral-700 dark:text-neutral-300">
                  <strong>Para resolver:</strong> {item.paraResolver}
                </span>
              )}
            </li>
          ))}
        </ul>
        <Link href="/situacao-dos-dados" className={`text-xs ${PROSE_LINK}`}>
          ver a situação de todos os dados
        </Link>
      </div>
    </details>
  );
}
