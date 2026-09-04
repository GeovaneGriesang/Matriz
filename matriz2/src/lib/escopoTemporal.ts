/**
 * O sistema controla o ciclo orçamentário de 2026 em diante — decisão explícita do
 * usuário em 2026-09-04. Ciclos anteriores a 2026 não são exibidos nem carregados
 * por este sistema, por mais que existam planilhas da MDO para eles: a Matriz de
 * Distribuição Orçamentária, no formato que este sistema entende, começa em 2026.
 *
 * Um só lugar para esse limite, usado tanto na carga (`scripts/carregar.ts`) quanto
 * nas telas administrativas que aceitam um ano (`cicloOrcamento.ts`).
 */
export const ANO_MINIMO_SISTEMA = 2026;

export function anoDentroDoEscopo(ano: number): boolean {
  return Number.isInteger(ano) && ano >= ANO_MINIMO_SISTEMA;
}
