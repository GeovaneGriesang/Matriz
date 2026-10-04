/**
 * Carrega o orçamento da União do IFSul (LOA e PLOA por ação, totais por exercício) e as emendas individuais do SIOP.
 *
 * Uso: npm run carregar:orcamento-loa
 *
 * Pode ser repetido: apaga e regrava só o que é do IFSul.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarEmendas, carregarOrcamentoLoa } from "../src/carga/carregarOrcamentoLoa";

async function main() {
  const r = await carregarOrcamentoLoa("IFSUL", "26436");
  console.log(`IFSul: ${r.linhas} créditos orçamentários e ${r.totais} totais por exercício.`);
  for (const a of r.avisos) console.log(`  AVISO: ${a}`);
  const e = await carregarEmendas("IFSUL", "26436", /SUL-RIO-GRANDENSE/i);
  console.log(e ? `Emendas: ${e.linhas} linhas do relatório ${e.arquivo}.` : "Emendas: relatório do SIOP não encontrado, pulando.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
