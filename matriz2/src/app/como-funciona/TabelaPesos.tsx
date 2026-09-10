export interface LinhaPeso {
  rotulo: string;
  /** Um valor por ano, na mesma ordem de `anos`; `null` quando o ciclo ainda não tem esse número. */
  valores: (number | null)[];
}

/**
 * Peso/taxa real, ano a ano, com o valor destacado em verde quando muda de um
 * ciclo para o outro (pedido do usuário: "destaque quando houver mudança de
 * pesos"). Existe pra sair da descrição qualitativa ("o EAD MOOC pesa bem menos")
 * e mostrar o número que de fato está valendo, lado a lado com o do ciclo anterior.
 */
export function TabelaPesos({
  anos,
  linhas,
  formatar,
}: {
  anos: number[];
  linhas: LinhaPeso[];
  formatar: (v: number) => string;
}) {
  const linhasComMudanca = linhas.map((l) => {
    const comparaveis = l.valores.filter((v): v is number => v !== null);
    const mudou = new Set(comparaveis).size > 1;
    return { ...l, mudou };
  });
  const algumaMudanca = linhasComMudanca.some((l) => l.mudou);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-400"></th>
              {anos.map((a) => (
                <th key={a} className="px-3 py-2 text-right font-medium text-neutral-600 dark:text-neutral-400">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasComMudanca.map((l) => (
              <tr key={l.rotulo} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">{l.rotulo}</td>
                {l.valores.map((v, i) => (
                  <td
                    key={anos[i]}
                    className={`px-3 py-2 text-right tabular-nums ${
                      l.mudou && v !== null ? "font-semibold text-if-green" : ""
                    }`}
                  >
                    {v === null ? "não informado" : formatar(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {algumaMudanca && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Em <span className="font-semibold text-if-green">verde</span>, valores que mudaram de um ciclo para o
          outro.
        </p>
      )}
    </div>
  );
}
