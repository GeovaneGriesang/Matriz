import { Resend } from "resend";

/**
 * Envio de e-mail via Resend, para o cadastro de conta e a recuperação de senha
 * (decisão do usuário em 2026-09-05: código por e-mail, não mais senha temporária
 * mostrada na tela). `RESEND_API_KEY` e `EMAIL_REMETENTE` ficam no `.env`; sem a
 * chave configurada, cada função lança um erro claro em vez de falhar calada — quem
 * chama decide o que fazer (ver `criarUsuarioAction`, que ainda cria o usuário e o
 * código mesmo se o e-mail falhar, para não perder o cadastro por causa disso).
 *
 * O cliente só é criado dentro de cada função, nunca no topo do módulo: o SDK do
 * Resend lança exceção síncrona se a chave estiver ausente, e este arquivo é
 * importado por `usuarios.ts`, que por sua vez alimenta várias páginas — construir
 * o cliente cedo demais derrubaria o app inteiro sempre que `RESEND_API_KEY` não
 * estivesse definida (como acontece em desenvolvimento local sem o Resend configurado).
 */
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function clienteResend(): Resend {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("RESEND_API_KEY não configurada no .env.");
  return new Resend(chave);
}

function exigirRemetente(): string {
  const remetente = process.env.EMAIL_REMETENTE;
  if (!remetente) throw new Error("EMAIL_REMETENTE não configurado no .env.");
  return remetente;
}

export async function enviarEmailCadastro(destino: { email: string; nome: string }, codigo: string): Promise<void> {
  const link = `${APP_URL}/admin/definir-senha?email=${encodeURIComponent(destino.email)}`;
  await clienteResend().emails.send({
    from: exigirRemetente(),
    to: destino.email,
    subject: "Você foi cadastrado no Matriz",
    text:
      `Olá, ${destino.nome}.\n\n` +
      `Uma conta foi criada para você no Matriz, o sistema de acompanhamento da matriz orçamentária.\n\n` +
      `Para o primeiro acesso, use o código abaixo em ${link}\n\n` +
      `Código: ${codigo}\n\n` +
      `Ele vale por 30 minutos. Se você não esperava este e-mail, pode ignorá-lo.`,
  });
}

export async function enviarEmailRecuperacao(destino: { email: string; nome: string }, codigo: string): Promise<void> {
  const link = `${APP_URL}/admin/definir-senha?email=${encodeURIComponent(destino.email)}`;
  await clienteResend().emails.send({
    from: exigirRemetente(),
    to: destino.email,
    subject: "Código para recuperar sua senha no Matriz",
    text:
      `Olá, ${destino.nome}.\n\n` +
      `Alguém (esperamos que você) pediu para trocar a senha da sua conta no Matriz.\n\n` +
      `Para continuar, use o código abaixo em ${link}\n\n` +
      `Código: ${codigo}\n\n` +
      `Ele vale por 30 minutos. Se você não pediu essa troca, pode ignorar este e-mail; sua senha continua a mesma.`,
  });
}
