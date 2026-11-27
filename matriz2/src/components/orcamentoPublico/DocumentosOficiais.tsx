import type { DocumentoOficial } from "@/lib/orcamento/documentosOficiais";

const EXPLICA: Record<DocumentoOficial["tipo"], string> = {
  PPA: "plano de quatro anos",
  LDO: "regras do ano seguinte",
  PLOA: "projeto do orçamento",
  LOA: "orçamento aprovado",
  Execução: "o que foi gasto",
};

/** A lista dos documentos oficiais, com o link para o site de origem de cada um. */
export function DocumentosOficiais({ documentos }: { documentos: DocumentoOficial[] }) {
  return (
    <div className="tabela-rolavel rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Lei</th>
            <th className="px-2 py-1.5 text-left font-medium">Ano</th>
            <th className="px-2 py-1.5 text-left font-medium">Documento</th>
            <th className="px-2 py-1.5 text-left font-medium">Formato</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {documentos.map((d) => (
            <tr key={d.url}>
              <td className="whitespace-nowrap px-2 py-1.5">
                <strong>{d.tipo}</strong> <span className="text-xs text-neutral-500">{EXPLICA[d.tipo]}</span>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5">{d.exercicio}</td>
              <td className="px-2 py-1.5">
                <a href={d.url} target="_blank" rel="noreferrer" className="text-if-green underline">
                  {d.titulo}
                </a>
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 text-neutral-600 dark:text-neutral-400">{d.formato}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
