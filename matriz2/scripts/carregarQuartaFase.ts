/**
 * Carrega as planilhas da 4ª fase da MDO (Checagem de Matrículas Totais) que estiverem em
 * "Exportados/01 - Matriz orçamentária/4a fase - Checagem de Matrículas Totais/<ciclo>/".
 *
 * Uso: npm run carregar:quarta-fase            (todas)
 *      npm run carregar:quarta-fase -- 2025     (só um ciclo)
 *
 * Pode ser repetido: cada arquivo substitui a própria carga anterior.
 */
import { prisma } from "../src/server/db/prisma";
import { planilhasQuartaFase } from "../src/carga/caminhos";
import { carregarQuartaFase } from "../src/carga/carregarQuartaFase";

const inteiro = new Intl.NumberFormat("pt-BR");

async function main() {
  const so = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n));
  const arquivos = planilhasQuartaFase().filter((a) => so.length === 0 || so.includes(a.ciclo));
  if (arquivos.length === 0) throw new Error("Nenhuma planilha da 4ª fase encontrada.");
  for (const a of arquivos) {
    const r = await carregarQuartaFase(a.caminho, a.ciclo);
    const conferencia = r.comResultado
      ? `${inteiro.format(r.iguais)} de ${inteiro.format(r.comResultado)} com todas as colunas iguais às fórmulas refeitas`
      : "arquivo sem resultados gravados (só fórmulas)";
    console.log(`${r.ciclo} | ${r.arquivo}: ${inteiro.format(r.ciclos)} ciclos, ${r.unidades} unidades; ${conferencia}.`);
    if (r.ignoradas) console.log(`  ${r.ignoradas} linhas ignoradas (sem código, unidade ou datas).`);
    for (const aviso of r.avisos) console.log(`  aviso: ${aviso}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
