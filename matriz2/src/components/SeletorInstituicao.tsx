"use client";

import { useRouter } from "next/navigation";

interface Instituicao {
  sigla: string;
  nome: string;
}

/**
 * Select de instituição que navega sozinho ao trocar. Cada página monta a URL de
 * destino para cada sigla (preservando ano e limpando o câmpus escolhido, que não
 * existe na instituição nova) e só entrega o mapa pronto, porque uma função não
 * atravessa a fronteira de Server para Client Component.
 */
export function SeletorInstituicao({
  instituicoes,
  siglaEscolhida,
  urlPorSigla,
}: {
  instituicoes: Instituicao[];
  siglaEscolhida: string;
  urlPorSigla: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <select
      value={siglaEscolhida}
      onChange={(e) => {
        const url = urlPorSigla[e.target.value];
        if (url) router.push(url);
      }}
      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    >
      {instituicoes.map((i) => (
        <option key={i.sigla} value={i.sigla}>
          {i.sigla} — {i.nome}
        </option>
      ))}
    </select>
  );
}
