/**
 * Confere na internet as fontes oficiais que alimentam o sistema e registra o que mudou (tela Situação dos dados).
 *
 * Uso: npm run verificar:fontes [-- chave]
 * Na VM roda toda segunda-feira pelo cron (ver README).
 */
import { prisma } from "../src/server/db/prisma";
import { verificarFontes } from "../src/server/fontes/verificarFontes";

async function main() {
  const r = await verificarFontes(process.argv[2]);
  console.log(new Date().toISOString());
  for (const x of r) console.log(`${x.erro ? "ERRO " : x.mudou ? "MUDOU" : x.primeira ? "NOVA " : "igual"}  ${x.nome}${x.erro ? `: ${x.erro}` : ""}${x.mudou && x.novidades ? `\n${x.novidades.replace(/^/gm, "    ")}` : ""}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
