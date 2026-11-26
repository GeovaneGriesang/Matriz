/**
 * Carrega a execução das emendas do IFSul por câmpus, dos arquivos mensais de despesas do Portal da Transparência.
 *
 * Uso: npm run carregar:emendas-executadas -- 2017 2026   (do primeiro ao último ano)
 *
 * Os arquivos ficam em Portal da Transparência/<ano>/AAAAMM_Despesas_IFSul.csv (só as linhas do IFSul) ou AAAAMM_Despesas.csv.
 * Pode ser repetido: apaga e regrava cada ano.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarEmendasExecutadas } from "../src/carga/carregarEmendasExecutadas";
import { executarCargaComAviso } from "../src/server/avisos/cargaComAviso";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const de = Number(process.argv[2] ?? 2014);
  const ate = Number(process.argv[3] ?? de);
  const anos = Array.from({ length: ate - de + 1 }, (_, k) => de + k);
  for (const r of await carregarEmendasExecutadas(anos)) {
    const faltam = Array.from({ length: 12 }, (_, k) => k + 1).filter((m) => !r.meses.includes(m));
    console.log(`${r.ano}: ${r.linhas} linhas, pago ${reais.format(r.pago)}${faltam.length ? ` (faltam os meses ${faltam.join(", ")})` : ""}`);
  }
  await prisma.$disconnect();
}

executarCargaComAviso(`Carga das emendas executadas no IFSul ${process.argv.slice(2).join(" ")}`, "/emendas/prestacao-de-contas", main).catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
