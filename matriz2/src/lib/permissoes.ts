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

/** Quem abre a tela Usuários: o administrador e o super-admin. A Auditoria continua só do super-admin. */
export function podeGerirUsuarios(papel: Papel): boolean {
  return papel === "ADMIN" || papel === "SUPER_ADMIN";
}

/** Com que perfil cada um cadastra: o super-admin cria administradores e padrões; o administrador, só padrões. O super-admin nunca é criado pela interface. */
export function perfisQueMeuPapelCria(papel: Papel): Papel[] {
  if (papel === "SUPER_ADMIN") return ["PADRAO", "ADMIN"];
  if (papel === "ADMIN") return ["PADRAO"];
  return [];
}

/** Resetar senha e ativar ou desativar: o super-admin age sobre qualquer conta; o administrador, só sobre as de perfil padrão. */
export function podeAgirSobreConta(solicitante: Papel, alvo: Papel): boolean {
  if (solicitante === "SUPER_ADMIN") return true;
  if (solicitante === "ADMIN") return alvo === "PADRAO";
  return false;
}
