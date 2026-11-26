import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envio de e-mail via SMTP (conta va-matriz@ifsul.edu.br), para o cadastro de conta e
 * a recuperação de senha (decisão em 2026-09-05: código por e-mail, não
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

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * O aviso do robô azul: fonte oficial que mudou, dados carregados ou versão nova. O remetente aparece como "Robô da Matriz"
 * e o assunto começa com o robô, para separar estes e-mails dos memorandos e das mensagens agendadas.
 */
export async function enviarEmailAviso(
  destinos: ReadonlyArray<{ email: string; nome: string }>,
  aviso: { rotulo: string; titulo: string; texto: string; link: string | null },
): Promise<void> {
  const endereco = (exigirRemetente().match(/<([^>]+)>/)?.[1] ?? exigirRemetente()).trim();
  const link = aviso.link ? `${APP_URL}${aviso.link}` : `${APP_URL}/avisos`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px">
  <div style="background:#1d4ed8;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-size:16px">
    <span style="display:inline-block;background:#fff;color:#1d4ed8;border-radius:50%;width:32px;height:32px;line-height:32px;text-align:center;font-size:20px;margin-right:10px">&#129302;</span>
    <strong>Robô da Matriz</strong> · ${escapar(aviso.rotulo)}
  </div>
  <div style="border:1px solid #bfdbfe;border-top:0;padding:16px 18px;border-radius:0 0 10px 10px">
    <h2 style="margin:0 0 10px;font-size:17px;color:#1e3a8a">${escapar(aviso.titulo)}</h2>
    <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;margin:0 0 14px">${escapar(aviso.texto)}</pre>
    <a href="${link}" style="background:#1d4ed8;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-size:14px">Ver no sistema</a>
    <p style="font-size:12px;color:#6b7280;margin-top:16px">Aviso automático do sistema da Matriz Orçamentária. A lista completa fica em ${APP_URL}/avisos.</p>
  </div>
</div>`;
  await transporte().sendMail({
    from: { name: "Robô da Matriz", address: endereco },
    to: destinos.map((d) => d.email),
    subject: `🤖 Matriz: ${aviso.titulo}`,
    text: `Robô da Matriz · ${aviso.rotulo}\n\n${aviso.titulo}\n\n${aviso.texto}\n\nVer no sistema: ${link}`,
    html,
  });
}
