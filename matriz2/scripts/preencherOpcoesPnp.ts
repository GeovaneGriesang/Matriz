/**
 * Recalcula as opções dos filtros das telas da PNP ("Detalhar por" e "Relação do órgão") de cada edição carregada. É o que faz as telas
 * abrirem na hora; sem isto, cada lista é calculada na primeira vez que alguém a pede (até 17 segundos em produção).
 *
 * Uso: npm run carregar:pnp-opcoes [-- <edição>]   (sem argumento, todas as edições carregadas)
 *
 * Pode ser repetido. Na VM, rode com `nice -n 19`: são varreduras de milhões de linhas.
 */
import { prisma } from "../src/server/db/prisma";
import { recalcularOpcoesPnp } from "../src/server/queries/opcoesPnp";

async function main() {
  const pedida = process.argv[2] ? Number(process.argv[2]) : null;
  const edicoes = pedida
    ? [pedida]
    : (await prisma.fonteDados.findMany({ where: { origem: "PNP_MANUAL" }, select: { cicloOrcamento: true }, distinct: ["cicloOrcamento"] })).map((f) => f.cicloOrcamento).sort();
  for (const edicao of edicoes) {
    console.log(`Edição ${edicao}`);
    await recalcularOpcoesPnp(edicao, (m) => console.log(m));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
