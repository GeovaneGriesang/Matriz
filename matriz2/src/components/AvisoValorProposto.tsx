import Link from "next/link";
import { PROSE_LINK } from "@/lib/layoutWidths";

/** Aviso das telas que mostram o valor informado, quando o do ano é o da proposta do Câmpus Sapucaia do Sul, e não o que o câmpus recebeu. */
export function AvisoValorProposto({ ano }: { ano: number }) {
  return (
    <p role="status" className="rounded-md border-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
      <strong>Os valores informados de {ano} ainda não são dinheiro recebido.</strong> São o resultado da proposta do Câmpus Sapucaia do Sul, que não é a regra do IFSul: 33% da
      diferença entre o valor de 2026 e a matriz de 2027. A conta de cada câmpus está em{" "}
      <Link href="/simulador/distribuicao" className={PROSE_LINK}>
        Distribuição entre câmpus
      </Link>
      .
    </p>
  );
}
