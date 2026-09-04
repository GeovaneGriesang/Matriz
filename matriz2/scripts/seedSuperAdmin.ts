/**
 * Cria o primeiro super-administrador do sistema, com senha gerada.
 *
 * Uso:
 *   npm run seed:superadmin -- geovane.griesang@gmail.com "Geovane Griesang"
 *   npm run seed:superadmin                                  (usa os padrões abaixo)
 *
 * Idempotente: se o e-mail já existir, não faz nada e avisa. É a única forma de
 * entrar no sistema pela primeira vez, já que o reset de senha (ver
 * `usuarios.ts`) exige que já exista um super-admin logado para resetar a
 * senha de outra pessoa.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/server/db/prisma";

const CUSTO_BCRYPT = 12;

function gerarSenhaTemporaria(): string {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const email = (process.argv[2] ?? "geovane.griesang@gmail.com").trim().toLowerCase();
  const nome = process.argv[3] ?? "Geovane Griesang";

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`Já existe um usuário com o e-mail ${email} (id ${existente.id}). Nada a fazer.`);
    console.log(`Se perdeu a senha, peça a outro super-admin para resetar em /admin/usuarios.`);
    await prisma.$disconnect();
    return;
  }

  const senha = gerarSenhaTemporaria();
  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  const usuario = await prisma.usuario.create({
    data: { email, nome, senhaHash, superAdmin: true },
  });

  console.log(`\nSuper-administrador criado: ${usuario.nome} <${usuario.email}> (id ${usuario.id})`);
  console.log(`Senha temporária (anote agora, não fica salva em lugar nenhum): ${senha}`);
  console.log(`Troque em /admin/conta assim que entrar.\n`);

  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error("Falhou:", erro instanceof Error ? erro.message : erro);
  await prisma.$disconnect();
  process.exit(1);
});
