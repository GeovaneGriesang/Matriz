import Image from "next/image";
import { InstitutoFederalMark } from "./InstitutoFederalMark";
import { GitHubIcon } from "@/components/icons/GitHubIcon";
import { apiUrl } from "@/lib/basePath";
import { MEMBROS_DA_COMISSAO, PORTARIA_DA_COMISSAO } from "@/lib/comissao";

const ICON_LINK_CLASS =
  "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100";

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
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4 print:hidden">
          <a
            href="https://github.com/GeovaneGriesang/Matriz"
            target="_blank"
            rel="noreferrer"
            title="Repositório no GitHub"
            aria-label="Repositório no GitHub"
            className={ICON_LINK_CLASS}
          >
            <GitHubIcon className="h-5 w-5" />
          </a>
          <a
            href="https://www.gov.br/mec/pt-br/pnp"
            target="_blank"
            rel="noreferrer"
            title="Plataforma Nilo Peçanha"
            aria-label="Plataforma Nilo Peçanha"
            className={ICON_LINK_CLASS}
          >
            <Image
              src="/branding/PNP.png"
              alt="Plataforma Nilo Peçanha"
              width={40}
              height={20}
              className="h-5 w-auto dark:invert"
            />
          </a>
          <a
            href="https://www.ifsul.edu.br"
            target="_blank"
            rel="noreferrer"
            title="Instituto Federal Sul-rio-grandense"
            aria-label="Instituto Federal Sul-rio-grandense"
            className={ICON_LINK_CLASS}
          >
            <InstitutoFederalMark size={20} />
          </a>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <a
            href="https://www.venancio.ifsul.edu.br/"
            target="_blank"
            rel="noreferrer"
            title="Instituto Federal Sul-rio-grandense - Câmpus Venâncio Aires"
            className="rounded-md bg-white p-2 dark:bg-transparent"
          >
            <Image
              src="/branding/ifsul-venancio-aires-horizontal.png"
              alt="Instituto Federal Sul-rio-grandense - Câmpus Venâncio Aires"
              width={211}
              height={48}
              className="h-14 w-auto dark:hidden"
            />
            <Image
              src="/branding/ifsul-venancio-aires-horizontal-mono.png"
              alt="Instituto Federal Sul-rio-grandense - Câmpus Venâncio Aires"
              width={211}
              height={48}
              className="hidden h-14 w-auto dark:block"
            />
          </a>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Instituto Federal Sul-rio-grandense, Câmpus Venâncio Aires.
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Desenvolvido por Geovane Griesang</p>
        </div>

        <section
          aria-labelledby="comissao-titulo"
          className="border-t border-neutral-200 pt-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
        >
          <h2 id="comissao-titulo" className="font-semibold text-neutral-700 dark:text-neutral-300">
            {PORTARIA_DA_COMISSAO.titulo}
          </h2>
          <p className="mt-1">
            Comissão que estuda e analisa a matriz orçamentária, designada pela{" "}
            <a
              href={apiUrl(PORTARIA_DA_COMISSAO.arquivo)}
              download={PORTARIA_DA_COMISSAO.nomeParaSalvar}
              title="Baixar o PDF da portaria"
              className="font-medium text-if-green underline dark:text-green-400 underline-offset-2 hover:no-underline print:no-underline"
            >
              Portaria nº {PORTARIA_DA_COMISSAO.numero}, de {PORTARIA_DA_COMISSAO.data}
            </a>
            .
          </p>
          <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {MEMBROS_DA_COMISSAO.map((m) => (
              <li key={m.nome}>
                {m.nome} ({m.presidente ? `${m.segmento}, presidente` : m.segmento})
              </li>
            ))}
          </ul>
        </section>
      </div>
    </footer>
  );
}
