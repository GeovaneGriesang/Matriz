/**
 * A marcação do que a DDI (Diretoria de Desenvolvimento Institucional) pediu, para ela achar mais fácil (pedido do usuário em
 * 2026-11-07): fundo amarelo claro e o selo "Pedido da DDI", no menu, na página inicial e no topo das telas. O amarelo é
 * diferente do âmbar dos avisos do sistema, para não ser lido como alerta.
 */

export const FUNDO_DDI = "bg-yellow-50 ring-1 ring-inset ring-yellow-300 dark:bg-yellow-950/40 dark:ring-yellow-800";

export function SeloDdi() {
  return (
    <span className="ml-1.5 inline-block whitespace-nowrap rounded bg-yellow-200 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100">
      Pedido da DDI
    </span>
  );
}

/** No topo da tela: o que a DDI pediu e onde está nesta tela. */
export function AvisoPedidoDaDdi({ children }: { children: React.ReactNode }) {
  return (
    <p className={`rounded-md px-3 py-2 text-sm text-yellow-950 dark:text-yellow-100 ${FUNDO_DDI}`}>
      <span className="mr-1.5 inline-block rounded bg-yellow-200 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100">
        Pedido da DDI
      </span>
      {children}
    </p>
  );
}
