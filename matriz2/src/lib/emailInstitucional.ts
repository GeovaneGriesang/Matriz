/** O domínio dos e-mails institucionais do IFSul. Pedidos de acesso de outro domínio são recusados na hora. */
export const DOMINIO_INSTITUCIONAL = "ifsul.edu.br";

/** E-mail institucional: termina em @ifsul.edu.br (ou num subdomínio dele, como @alguma.ifsul.edu.br). */
export function ehEmailInstitucional(email: string): boolean {
  const m = /^[^\s@]+@([^\s@]+)$/.exec(email.trim().toLowerCase());
  if (!m) return false;
  const dominio = m[1]!;
  return dominio === DOMINIO_INSTITUCIONAL || dominio.endsWith(`.${DOMINIO_INSTITUCIONAL}`);
}

export const MENSAGEM_SO_INSTITUCIONAL =
  `O acesso só é dado com o e-mail institucional (@${DOMINIO_INSTITUCIONAL}). Faça o pedido de novo com o seu e-mail do IFSul.`;
