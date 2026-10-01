/**
 * Monta a tabela de peso efetivo por curso a partir da 6ª fase já carregada.
 *
 * Uso: npm run carregar:peso-efetivo -- 2027
 *
 * Rode depois de `npm run carregar -- <ano>`. Pode ser repetido: regrava só as linhas do ano.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarPesoEfetivo } from "../src/carga/carregarPesoEfetivo";

const inteiro = new Intl.NumberFormat("pt-BR");

async function main() {
  const anos = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n));
  if (anos.length === 0) throw new Error("Informe o ciclo orçamentário: npm run carregar:peso-efetivo -- 2027");
  for (const ano of anos) {
    const r = await carregarPesoEfetivo(ano);
    if (!r) {
      console.log(`${ano}: sem ciclos da 6ª fase no banco, nada a fazer.`);
      continue;
    }
    console.log(
      `${ano}: ${inteiro.format(r.linhas)} linhas, ${inteiro.format(r.ciclos)} ciclos observados, ${inteiro.format(r.concordantes)} concordam (${((r.concordantes / r.ciclos) * 100).toFixed(2)}%). Fonte: ${r.arquivo}`,
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
