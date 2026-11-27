/**
 * A marcação do que a DDI (Diretoria de Desenvolvimento Institucional) pediu, para ela achar mais fácil (pedido em
 * 2026-11-07): fundo amarelo claro e o selo "Pedido da DDI". É uma das marcações de `Marcacoes`.
 */
import { AvisoDaMarca, MARCAS, Selo } from "@/components/Marcacoes";

export const FUNDO_DDI = MARCAS.ddi.fundo;

export function SeloDdi() {
  return <Selo marca="ddi" />;
}

/** No topo da tela: o que a DDI pediu e onde está nesta tela. */
export function AvisoPedidoDaDdi({ children }: { children: React.ReactNode }) {
  return <AvisoDaMarca marca="ddi">{children}</AvisoDaMarca>;
}
