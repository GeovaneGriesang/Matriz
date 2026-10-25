/**
 * Decisão de 2026-10-08: o usuário PADRAO vê os dados e faz as simulações (inclusive salvá-las e compartilhá-las), como o ADMIN.
 * O que ele NÃO faz: ver ou alterar Valores recebidos e Correção manual, gerir usuários ou ver a Auditoria.
 * Decisão de 2026-10-25: o ADMIN vê Valores recebidos e Correção manual, mas só o SUPER_ADMIN altera; e só o SUPER_ADMIN muda o
 * perfil de outro usuário.
 * Para voltar a esconder as telas de dados dele, basta pôr `false` em `PADRAO_VE_E_SIMULA`.
 */
export const PADRAO_VE_E_SIMULA = true;

type Papel = "SUPER_ADMIN" | "ADMIN" | "PADRAO";

/** Telas de dados (Consulta, Comparativo, PNP, Simulador...), chat, simulações salvas. */
export function temAcessoPleno(papel: Papel): boolean {
  return PADRAO_VE_E_SIMULA || papel !== "PADRAO";
}

/** Chat com o Gemini (Google): administrador e super-admin. O perfil padrão usa o chat com o modelo do próprio servidor, sem enviar nada ao Google. */
export function podeUsarGemini(papel: Papel): boolean {
  return papel === "ADMIN" || papel === "SUPER_ADMIN";
}

/** Ver as telas Valores recebidos e Correção manual (sem alterar). */
export function podeVerValores(papel: Papel): boolean {
  return papel === "ADMIN" || papel === "SUPER_ADMIN";
}

/** Informar ou corrigir valores (Valores recebidos, Correção manual do orçamento): só o super-admin. */
export function podeInformarValores(papel: Papel): boolean {
  return papel === "SUPER_ADMIN";
}

/** Mudar o perfil de outro usuário (entre Admin e Padrão): só o super-admin, nunca o próprio nem o de outro super-admin. */
export function podeMudarPerfil(solicitante: Papel, alvo: Papel, ehOProprio: boolean): boolean {
  return solicitante === "SUPER_ADMIN" && alvo !== "SUPER_ADMIN" && !ehOProprio;
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
