"use client";

import { useRouter } from "next/navigation";

export interface CampusOpcao {
  id: number;
  nome: string;
  instituicaoSigla: string;
}

export interface CursoOpcao {
  id: number;
  curso: string;
  valor: number;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Um "slot" de comparação: escolhe um câmpus (rede inteira, agrupado por
 * instituição) e, dentro dele, um curso. Navega direto (router.push), como o
 * `SeletorInstituicao`: uma função não atravessaria a fronteira de Server para
 * Client Component, então quem monta a URL de destino é este componente, a partir
 * só de dado simples (`paramsAtuais`).
 */
export function SeletorSlotCurso({
  indice,
  campiRede,
  campusEscolhido,
  cursosDoCampus,
  cursoEscolhido,
  paramsAtuais,
  podeRemover,
}: {
  indice: number;
  campiRede: CampusOpcao[];
  campusEscolhido: number;
  cursosDoCampus: CursoOpcao[];
  cursoEscolhido: number | null;
  paramsAtuais: Record<string, string>;
  podeRemover: boolean;
}) {
  const router = useRouter();

  function navegar(mudanca: Record<string, string | undefined>) {
    const novos = { ...paramsAtuais, ...mudanca };
    const q = new URLSearchParams();
    for (const [chave, valor] of Object.entries(novos)) {
      if (valor !== undefined) q.set(chave, valor);
    }
    router.push(`/consulta/comparar?${q.toString()}`);
  }

  const instituicoes = Array.from(new Set(campiRede.map((c) => c.instituicaoSigla)));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Câmpus {indice}</span>
        {podeRemover && (
          <button
            type="button"
            onClick={() => navegar({ [`campus${indice}`]: undefined, [`curso${indice}`]: undefined })}
            className="text-xs text-neutral-500 underline hover:text-if-red"
          >
            remover
          </button>
        )}
      </div>

      <select
        value={campusEscolhido}
        onChange={(e) =>
          navegar({ [`campus${indice}`]: e.target.value, [`curso${indice}`]: undefined })
        }
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {instituicoes.map((sigla) => (
          <optgroup key={sigla} label={sigla}>
            {campiRede
              .filter((c) => c.instituicaoSigla === sigla)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      <select
        value={cursoEscolhido ?? ""}
        onChange={(e) => navegar({ [`curso${indice}`]: e.target.value })}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {cursosDoCampus.map((c) => (
          <option key={c.id} value={c.id}>
            {c.curso} ({reais.format(c.valor)})
          </option>
        ))}
      </select>
    </div>
  );
}
