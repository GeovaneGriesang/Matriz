import Link from "next/link";
import { CONFIANCA, NIVEIS, type IdConfianca, type ItemConfianca } from "@/lib/confianca";
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

/** Uma faixa com vários selos, para o topo de uma tela. */
export function PainelConfianca({ ids }: { ids: IdConfianca[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Confiança dos números desta tela</span>
        <Link href="/situacao-dos-dados" className={`text-xs ${PROSE_LINK}`}>
          ver a situação de todos os dados
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <SeloConfianca key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
