/**
 * Carrega as emendas impositivas ao orçamento de Venâncio Aires, da página da Câmara de Vereadores.
 *
 * Uso: npm run carregar:emendas-municipais                 (todas, desde a primeira publicada)
 *      npm run carregar:emendas-municipais -- --desde=2026  (só as das leis orçamentárias de 2026 em diante)
 *      npm run carregar:emendas-municipais -- --tudo        (abre de novo cada emenda, mesmo sem mudança de situação)
 */
import { prisma } from "../src/server/db/prisma";
import { carregarEmendasMunicipais } from "../src/carga/carregarEmendasMunicipais";
import { executarCargaComAviso } from "../src/server/avisos/cargaComAviso";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const desde = Number(process.argv.find((a) => a.startsWith("--desde="))?.split("=")[1] ?? 0) || undefined;
  const tudo = process.argv.includes("--tudo");
  const r = await carregarEmendasMunicipais({ desde, tudo });
  console.log(`${r.paginas} páginas lidas: ${r.novas} emendas novas, ${r.atualizadas} atualizadas, ${r.semMudanca} sem mudança.`);
  for (const [ano, v] of [...r.porExercicio.entries()].sort((a, b) => a[0] - b[0])) console.log(`LOA ${ano}: ${v.quantidade} emendas, ${reais.format(v.valor)}`);
  await prisma.$disconnect();
}

executarCargaComAviso(`Carga das emendas impositivas de Venâncio Aires ${process.argv.slice(2).join(" ")}`, "/orcamento-municipal", main).catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
