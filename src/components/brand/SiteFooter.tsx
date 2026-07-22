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
    <footer className="mt-auto border-t border-neutral-200 bg-white px-6 py-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 text-center">
        <Image
          src="/branding/ifsul-venancio-aires-horizontal.png"
          alt="Instituto Federal Sul-rio-grandense - Câmpus Venâncio Aires"
          width={211}
          height={48}
          className="h-8 w-auto"
        />
        <p className="text-xs text-neutral-500">
          Desenvolvido pelo Instituto Federal Sul-rio-grandense — Câmpus Venâncio Aires.
        </p>
      </div>
    </footer>
  );
}
