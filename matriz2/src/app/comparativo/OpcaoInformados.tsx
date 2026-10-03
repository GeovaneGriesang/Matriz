"use client";

import { useRouter } from "next/navigation";

/**
 * A opção do comparativo: ver as comparações só com os valores CALCULADOS pela matriz (padrão) ou também com os INFORMADOS do IFSul (o que
 * os câmpus de fato receberam). Fica na URL (`informados=1`), então vale ao trocar de bloco e dá para mandar o link.
 */
export function OpcaoInformados({ marcado, bloco }: { marcado: boolean; bloco: string }) {
  const router = useRouter();

  function mudar(ligar: boolean) {
    const q = new URLSearchParams({ bloco });
    if (ligar) q.set("informados", "1");
    // scroll: false mantém a página onde está.
    router.push(`/comparativo?${q.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <input type="checkbox" checked={marcado} onChange={(e) => mudar(e.target.checked)} className="mt-1 h-4 w-4 accent-if-green" />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Considerar dados informados para o IFSul</span>
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          Dados informados são o que os câmpus realmente receberam (distribuição interna), cadastrados em Valores recebidos. Desmarcado, o comparativo usa só os valores
          calculados pela matriz; marcado, o IFSul passa a mostrar também o informado de cada ciclo e as variações entre calculado e informado.
        </span>
      </span>
    </label>
  );
}
