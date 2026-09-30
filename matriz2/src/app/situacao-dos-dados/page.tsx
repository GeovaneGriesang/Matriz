import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { requireAcessoPlenoOrRedirect } from "@/server/auth/session";
import { CONFIANCA, NIVEIS, type NivelConfianca } from "@/lib/confianca";
import { SeloConfianca } from "@/components/Confianca";

export const dynamic = "force-dynamic";

const ORDEM: NivelConfianca[] = ["CONFERIDO", "ATENCAO", "ESTIMADO"];

export default async function SituacaoDosDadosPage() {
  await requireAcessoPlenoOrRedirect("/situacao-dos-dados");
  const itens = Object.entries(CONFIANCA) as [keyof typeof CONFIANCA, (typeof CONFIANCA)[keyof typeof CONFIANCA]][];

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Situação dos dados</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Nem todo número do sistema tem o mesmo grau de certeza. Aqui está, num lugar só, o que foi conferido, o que precisa de
          revisão e o que é estimativa ou definição nossa, com o motivo de cada um. As mesmas marcas aparecem no topo das telas
          que dependem delas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {ORDEM.map((n) => {
          const nivel = NIVEIS[n];
          const total = itens.filter(([, i]) => i.nivel === n).length;
          return (
            <div key={n} className={`rounded-lg border p-4 ${nivel.classes}`}>
              <div className="text-sm font-semibold">
                <span aria-hidden>{nivel.icone}</span> {nivel.rotulo} ({total})
              </div>
              <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">{nivel.descricao}</p>
            </div>
          );
        })}
      </div>

      {ORDEM.map((n) => (
        <section key={n} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{NIVEIS[n].rotulo}</h2>
          <div className="flex flex-col gap-2">
            {itens
              .filter(([, i]) => i.nivel === n)
              .map(([id]) => (
                <SeloConfianca key={id} id={id} />
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}
