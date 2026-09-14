import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envio de e-mail via SMTP (conta va-matriz@ifsul.edu.br), para o cadastro de conta e
 * a recuperação de senha (decisão do usuário em 2026-09-05: código por e-mail, não
 * mais senha temporária mostrada na tela). `SMTP_USER`, `SMTP_PASS` (senha de app) e
 * `EMAIL_REMETENTE` ficam no `.env`; sem eles configurados, cada função lança um erro
 * claro em vez de falhar calada — quem chama decide o que fazer (ver
 * `criarUsuarioAction`, que ainda cria o usuário e o código mesmo se o e-mail falhar,
 * para não perder o cadastro por causa disso).
 *
 * O transporte só é criado dentro de cada função, nunca no topo do módulo, pelo mesmo
 * motivo de antes com o cliente Resend: este arquivo é importado por `usuarios.ts`,
 * que alimenta várias páginas, e construir o transporte cedo demais faria falta de
 * `SMTP_USER`/`SMTP_PASS` derrubar o app inteiro (como acontece em desenvolvimento
 * local sem o SMTP configurado) em vez de falhar só na hora do envio.
 */
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function transporte(): Transporter {
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("SMTP_USER/SMTP_PASS não configurados no .env.");
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function exigirRemetente(): string {
  const remetente = process.env.EMAIL_REMETENTE;
  if (!remetente) throw new Error("EMAIL_REMETENTE não configurado no .env.");
  return remetente;
}

export async function enviarEmailCadastro(destino: { email: string; nome: string }, codigo: string): Promise<void> {
  const link = `${APP_URL}/admin/definir-senha?email=${encodeURIComponent(destino.email)}`;
  await transporte().sendMail({
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
  await transporte().sendMail({
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
