/**
 * As marcações das telas, cada uma com cor e selo próprios, no menu, na página inicial e no topo da tela:
 * - Pedido da DDI (amarelo): o que a Diretoria de Desenvolvimento Institucional pediu, para ela achar mais fácil;
 * - Interno do IFSul (azul): o que vale só dentro do IFSul, como a distribuição interna da matriz entre os câmpus;
 * - Estadual (rosa) e Municipal (lilás): o orçamento do Estado do RS e o do município, que não são da Rede Federal.
 * O amarelo é diferente do âmbar dos avisos do sistema, para não ser lido como alerta.
 */

export type Marca = "ddi" | "interno" | "estadual" | "municipal";

interface EstiloDaMarca {
  rotulo: string;
  /** Para a legenda da página inicial: o que a marca quer dizer. */
  significado: string;
  fundo: string;
  selo: string;
  texto: string;
  hover: string;
}

export const MARCAS: Record<Marca, EstiloDaMarca> = {
  ddi: {
    rotulo: "Pedido da DDI",
    significado: "telas que a DDI pediu",
    fundo: "bg-yellow-50 ring-1 ring-inset ring-yellow-300 dark:bg-yellow-950/40 dark:ring-yellow-800",
    selo: "bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100",
    texto: "text-yellow-950 dark:text-yellow-100",
    hover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/40",
  },
  interno: {
    rotulo: "Interno do IFSul",
    significado: "o que vale só dentro do IFSul, como a distribuição interna entre os câmpus",
    fundo: "bg-sky-50 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/40 dark:ring-sky-800",
    selo: "bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100",
    texto: "text-sky-950 dark:text-sky-100",
    hover: "hover:bg-sky-100 dark:hover:bg-sky-900/40",
  },
  estadual: {
    rotulo: "Estadual",
    significado: "o orçamento do Estado do RS",
    fundo: "bg-rose-50 ring-1 ring-inset ring-rose-300 dark:bg-rose-950/40 dark:ring-rose-800",
    selo: "bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100",
    texto: "text-rose-950 dark:text-rose-100",
    hover: "hover:bg-rose-100 dark:hover:bg-rose-900/40",
  },
  municipal: {
    rotulo: "Municipal",
    significado: "o orçamento do município do câmpus",
    fundo: "bg-violet-50 ring-1 ring-inset ring-violet-300 dark:bg-violet-950/40 dark:ring-violet-800",
    selo: "bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-100",
    texto: "text-violet-950 dark:text-violet-100",
    hover: "hover:bg-violet-100 dark:hover:bg-violet-900/40",
  },
};

/** A ordem da legenda. */
export const ORDEM_DAS_MARCAS: Marca[] = ["ddi", "interno", "estadual", "municipal"];

export function Selo({ marca, className = "ml-1.5" }: { marca: Marca; className?: string }) {
  return (
    <span className={`${className} inline-block whitespace-nowrap rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide ${MARCAS[marca].selo}`}>
      {MARCAS[marca].rotulo}
    </span>
  );
}

/** No topo da tela: o selo e uma frase sobre o que a tela tem. */
export function AvisoDaMarca({ marca, children }: { marca: Marca; children: React.ReactNode }) {
  return (
    <p className={`rounded-md px-3 py-2 text-sm ${MARCAS[marca].texto} ${MARCAS[marca].fundo}`}>
      <Selo marca={marca} className="mr-1.5" />
      {children}
    </p>
  );
}
