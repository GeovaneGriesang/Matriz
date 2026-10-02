import Link from "next/link";
import { MODALIDADES, ROTULO_FORMA_DE_ENSINO, type ChaveModalidade, type FormaDeEnsino } from "@/lib/modalidadeCurso";

/**
 * O primeiro filtro da comparação: a MODALIDADE dos cursos (técnico integrado, técnico subsequente, Proeja, FIC, superior, pós) e a
 * forma de ensino (presencial ou a distância). Só entram nas listas os cursos e os câmpus que têm curso nesse recorte, para não
 * se comparar um técnico integrado com um bacharelado. São links comuns: cada botão recarrega a página com o recorte escolhido.
 */
export function FiltroDeModalidade({
  modalidade,
  ensino,
  paramsAtuais,
}: {
  modalidade: ChaveModalidade | undefined;
  ensino: FormaDeEnsino | undefined;
  paramsAtuais: Record<string, string>;
}) {
  function href(mudanca: Record<string, string | undefined>) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...paramsAtuais, ...mudanca })) if (v !== undefined) q.set(k, v);
    return `/consulta/comparar?${q.toString()}`;
  }
  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      ativo ? "bg-if-green text-white" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    }`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Modalidade dos cursos</h2>
        <p className="text-xs text-neutral-500">
          Escolha a modalidade antes de escolher os cursos: só aparecem os câmpus e os cursos dessa modalidade, para você não comparar, por exemplo, um técnico integrado com um bacharelado.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={href({ modalidade: undefined })} className={chip(modalidade === undefined)} aria-current={modalidade === undefined ? "true" : undefined}>
          Todas
        </Link>
        {MODALIDADES.map((m) => (
          <Link key={m.chave} href={href({ modalidade: m.chave })} title={m.ajuda} className={chip(modalidade === m.chave)} aria-current={modalidade === m.chave ? "true" : undefined}>
            {m.rotulo}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Forma de ensino</span>
        <Link href={href({ ensino: undefined })} className={chip(ensino === undefined)}>
          Todas
        </Link>
        {(["presencial", "ead"] as const).map((f) => (
          <Link key={f} href={href({ ensino: f })} className={chip(ensino === f)}>
            {ROTULO_FORMA_DE_ENSINO[f]}
          </Link>
        ))}
      </div>
    </div>
  );
}
