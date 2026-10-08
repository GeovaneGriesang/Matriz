/**
 * Decisão de 2026-10-08: o usuário PADRAO vê os dados e faz as simulações (inclusive salvá-las e compartilhá-las), como o ADMIN.
 * O que ele NÃO faz: informar ou corrigir valores (Valores recebidos e Correção manual) e gerir usuários ou ver a Auditoria.
 * Para voltar a esconder as telas de dados dele, basta pôr `false` em `PADRAO_VE_E_SIMULA`.
 */
export const PADRAO_VE_E_SIMULA = true;

type Papel = "SUPER_ADMIN" | "ADMIN" | "PADRAO";

/** Telas de dados (Consulta, Comparativo, PNP, Simulador...), chat, simulações salvas. */
export function temAcessoPleno(papel: Papel): boolean {
  return PADRAO_VE_E_SIMULA || papel !== "PADRAO";
}

/** Informar ou corrigir valores (Valores recebidos, Correção manual do orçamento). */
export function podeInformarValores(papel: Papel): boolean {
  return papel !== "PADRAO";
}
