import Image from "next/image";

/**
 * Crédito institucional exigido pelo IFSul - Câmpus Venâncio Aires: mesmo
 * sendo uma ferramenta de uso geral (qualquer Instituto Federal pode usá-la),
 * a autoria do desenvolvimento deve ficar sempre visível. Respeita a reserva
 * de integridade (padding ao redor da marca) e a redução mínima (símbolo
 * nunca abaixo de ~30px) do Manual de Aplicação da Marca IF.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white px-6 py-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 text-center">
        <div className="rounded-md bg-white p-2 dark:bg-white">
          <Image
            src="/branding/ifsul-venancio-aires-horizontal.png"
            alt="Instituto Federal Sul-rio-grandense - Câmpus Venâncio Aires"
            width={211}
            height={48}
            className="h-14 w-auto"
          />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Instituto Federal Sul-rio-grandense — Câmpus Venâncio Aires.
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Desenvolvido por Geovane Griesang</p>
      </div>
    </footer>
  );
}
