/**
 * Carrega o RREO do Estado do RS e do município de Venâncio Aires, do Siconfi (Tesouro Nacional), ano a ano.
 *
 * Uso: npm run carregar:siconfi -- 2015 2026   (do primeiro ao último ano; sem anos, carrega o ano corrente e o anterior)
 *
 * Pode ser repetido: apaga e regrava cada ano de cada ente com o último bimestre publicado.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarSiconfi } from "../src/carga/carregarSiconfi";
import { ENTES, type Ente } from "../src/lib/orcamento/siconfi";
import { executarCargaComAviso } from "../src/server/avisos/cargaComAviso";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function main() {
  const atual = new Date().getFullYear();
  const de = Number(process.argv[2] ?? atual - 1);
  const ate = Number(process.argv[3] ?? (process.argv[2] ? de : atual));
  for (const ente of Object.keys(ENTES) as Ente[]) {
    for (let ano = de; ano <= ate; ano++) {
      const r = await carregarSiconfi(ente, ano);
      console.log(
        r.periodo === null
          ? `${ENTES[ente].curto} ${ano}: nenhum relatório publicado`
          : `${ENTES[ente].curto} ${ano}: ${r.periodo}º bimestre, ${r.linhas} linhas, despesa empenhada ${r.despesaEmpenhada !== undefined ? reais.format(r.despesaEmpenhada) : "-"}, receita arrecadada ${r.receitaRealizada !== undefined ? reais.format(r.receitaRealizada) : "-"}`,
      );
    }
  }
  await prisma.$disconnect();
}

executarCargaComAviso(`Carga dos relatórios fiscais do Estado e de Venâncio Aires (Siconfi) ${process.argv.slice(2).join(" ")}`, "/orcamento-do-estado", main).catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
