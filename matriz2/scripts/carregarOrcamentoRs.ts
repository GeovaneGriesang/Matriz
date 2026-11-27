/**
 * Carrega a despesa e a receita do projeto de lei orçamentária do Estado do RS, das planilhas oficiais da Secretaria de Planejamento.
 *
 * Uso: npm run carregar:orcamento-rs -- 2027
 *
 * As planilhas ficam em "Orçamento do Estado do RS/<ano>/" (ploa-<ano>-despesas.xlsx e ploa-<ano>-receitas.xlsx). Pode ser repetido.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarOrcamentoRs } from "../src/carga/carregarOrcamentoRs";
import { executarCargaComAviso } from "../src/server/avisos/cargaComAviso";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function main() {
  const exercicio = Number(process.argv[2] ?? new Date().getFullYear() + 1);
  const r = await carregarOrcamentoRs(exercicio);
  console.log(`PLOA ${r.exercicio} do Estado do RS: ${r.linhasDespesa} linhas de despesa (${reais.format(r.despesa)}) e ${r.linhasReceita} de receita (${reais.format(r.receita)}).`);
  await prisma.$disconnect();
}

executarCargaComAviso(`Carga do orçamento do Estado do RS ${process.argv.slice(2).join(" ")}`, "/orcamento-do-estado", main).catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
