"use client";

/** Δ absoluto e percentual entre dois valores; `null` quando um dos lados não existe (item novo/saiu). */
export function calcularVariacao(
  valorAnterior: number | null,
  valorAtual: number | null,
): { delta: number | null; percentual: number | null } {
  if (valorAnterior === null || valorAtual === null) return { delta: null, percentual: null };
  const delta = valorAtual - valorAnterior;
  const percentual = valorAnterior !== 0 ? delta / valorAnterior : delta !== 0 ? null : 0;
  return { delta, percentual };
}

/** Badge de variação: ▲ verde se subiu, ▼ vermelho se caiu, = cinza se estável. `children` é o texto já formatado. */
export function Variacao({ delta, children }: { delta: number | null; children: React.ReactNode }) {
  if (delta === null) {
    return <span className="text-neutral-400 dark:text-neutral-600">—</span>;
  }
  const estavel = Math.abs(delta) < 0.005;
  const cor = estavel
    ? "text-neutral-500 dark:text-neutral-400"
    : delta > 0
      ? "text-green-700 dark:text-green-400"
      : "text-red-700 dark:text-red-400";
  const seta = estavel ? "=" : delta > 0 ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${cor}`}>
      <span aria-hidden="true">{seta}</span>
      {children}
    </span>
  );
}
