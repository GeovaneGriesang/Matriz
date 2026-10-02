"use client";

import { useRouter } from "next/navigation";
import type { ModoFiltro } from "@/lib/compararCursos";

/**
 * O que aparece nas opções dos cursos que se comparam com o principal (o primeiro): todos, só o mesmo curso, só cursos
 * de mesmo peso, e, à parte, só o mesmo câmpus do principal (para comparar cursos de um câmpus só). Muda a URL e a página
 * recarrega com as opções já filtradas.
 */
export function FiltroComparacao({
  modo,
  mesmoCampus,
  paramsAtuais,
  rotuloPrincipal,
  pesoPrincipal,
}: {
  modo: ModoFiltro;
  mesmoCampus: boolean;
  paramsAtuais: Record<string, string>;
  rotuloPrincipal: string;
  pesoPrincipal: number | null;
}) {
  const router = useRouter();

  function ir(mudanca: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...paramsAtuais, ...mudanca })) if (v !== undefined) q.set(k, v);
    // scroll: false mantém a página onde está (por padrão a navegação volta ao topo, e a pessoa teria de descer de novo).
    router.push(`/consulta/comparar?${q.toString()}`, { scroll: false });
  }

  const opcoes: { valor: ModoFiltro; rotulo: string; ajuda: string }[] = [
    { valor: "todos", rotulo: "Todos os cursos", ajuda: "Qualquer curso de qualquer câmpus." },
    { valor: "curso", rotulo: "Só o mesmo curso", ajuda: `Só ${rotuloPrincipal}, em outros câmpus.` },
    { valor: "peso", rotulo: "Só cursos de mesmo peso", ajuda: pesoPrincipal !== null ? `Só cursos de peso ${pesoPrincipal.toString().replace(".", ",")}, como o principal.` : "O principal não tem peso informado." },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">O que aparece nas opções dos outros cursos</h2>
        <p className="text-xs text-neutral-500">O primeiro curso é o principal: os outros são comparados a ele. Marque uma opção para só mostrar o que é comparável.</p>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {opcoes.map((o) => (
          <label key={o.valor} className="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
            <input type="radio" name="filtro" checked={modo === o.valor} onChange={() => ir({ filtro: o.valor === "todos" ? undefined : o.valor })} className="mt-1" />
            <span>
              {o.rotulo}
              <span className="block text-xs text-neutral-500">{o.ajuda}</span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
          <input type="checkbox" checked={mesmoCampus} onChange={(e) => ir({ mesmoCampus: e.target.checked ? "1" : undefined })} className="mt-1" />
          <span>
            Só o mesmo câmpus do principal
            <span className="block text-xs text-neutral-500">Compara cursos de um câmpus só.</span>
          </span>
        </label>
      </div>
    </div>
  );
}
