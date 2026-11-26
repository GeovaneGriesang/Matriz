/**
 * Registra o aviso de versão nova do sistema (robô azul), com o que mudou desde o último aviso de versão: os títulos dos
 * commits publicados. Roda no fim do deploy, na VM, depois do pm2 restart.
 *
 * Uso: npm run avisar:versao
 */
import { execSync } from "node:child_process";
import { prisma } from "../src/server/db/prisma";
import { registrarAviso } from "../src/server/avisos/avisos";

async function main() {
  const atual = execSync("git rev-parse HEAD").toString().trim();
  const ultimo = await prisma.avisoDoSistema.findFirst({ where: { tipo: "versao" }, orderBy: { criadoEm: "desc" }, select: { referencia: true } });
  if (ultimo?.referencia === atual) {
    console.log("Sem versão nova desde o último aviso.");
    return;
  }
  let faixa = "-1";
  if (ultimo?.referencia) {
    try {
      execSync(`git cat-file -e ${ultimo.referencia}^{commit}`, { stdio: "ignore" });
      faixa = `${ultimo.referencia}..HEAD`;
    } catch {
      faixa = "-1";
    }
  }
  const titulos = execSync(`git log --format=%s ${faixa}`).toString().trim().split("\n").filter(Boolean).reverse();
  await registrarAviso({
    tipo: "versao",
    titulo: titulos.length === 1 ? "Nova versão do sistema publicada" : `Nova versão do sistema publicada (${titulos.length} mudanças)`,
    texto: titulos.map((t) => `• ${t}`).join("\n"),
    referencia: atual,
  });
  console.log(`Aviso registrado: ${titulos.length} mudança(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
