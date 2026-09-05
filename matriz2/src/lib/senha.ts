/**
 * Regra de senha forte, pedida pelo usuário em 2026-09-05: 8+ caracteres, com pelo
 * menos 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial. Usada em toda
 * ação que grava uma senha nova (primeiro acesso, recuperação, troca voluntária).
 *
 * Devolve a mensagem do primeiro requisito que falhar, ou `null` se a senha atende
 * a todos — assim quem chama só precisa checar `if (erro) ...`, sem repetir a regra.
 */
export function validarForcaSenha(senha: string): string | null {
  if (senha.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  if (!/[A-Z]/.test(senha)) return "A senha precisa de pelo menos 1 letra maiúscula.";
  if (!/[a-z]/.test(senha)) return "A senha precisa de pelo menos 1 letra minúscula.";
  if (!/[0-9]/.test(senha)) return "A senha precisa de pelo menos 1 número.";
  if (!/[^A-Za-z0-9]/.test(senha)) return "A senha precisa de pelo menos 1 caractere especial.";
  return null;
}
