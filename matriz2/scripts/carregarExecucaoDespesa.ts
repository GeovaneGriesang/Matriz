/**
 * Carrega a execução da despesa do IFSul (Portal da Transparência, CGU): um CSV por mês e o orçamento da despesa do ano.
 *
 * Uso: npm run carregar:execucao-despesa [-- <ano>]   (padrão 2026)
 *
 * Pode ser repetido: apaga e regrava o ano do IFSul.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarExecucaoDespesa } from "../src/carga/carregarExecucaoDespesa";

async function main() {
  const ano = Number(process.argv[2] ?? 2026);
  const r = await carregarExecucaoDespesa("IFSUL", "26436", ano);
  console.log(`IFSul ${ano}: meses ${r.meses.join(", ")}; ${r.linhasExecucao} linhas de execução por UG e ${r.linhasOrcamento} ações no orçamento.`);
  for (const a of r.avisos) console.log(`  AVISO: ${a}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
