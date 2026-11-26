/**
 * Carrega as emendas apresentadas ao PLOA para a Rede Federal, do espelho oficial da Comissão Mista de Orçamento.
 *
 * Uso: npm run carregar:emendas -- 2027
 *
 * Antes, converta os PDFs do portal do Congresso em texto na pasta Emendas/<exercício>/_texto:
 *   pdftotext -enc UTF-8 -raw "Espelho - Emendas de Despesa - PLOA 2027.pdf" _texto/espelho_despesa.txt
 *   pdftotext -enc UTF-8 -raw "RECIBOS-Individuais - PLOA 2027.pdf" _texto/recibos_individuais.txt
 *
 * Pode ser repetido: apaga e regrava as emendas do exercício.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarEmendasApresentadas } from "../src/carga/carregarEmendasApresentadas";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const exercicio = Number(process.argv[2] ?? 2027);
  const r = await carregarEmendasApresentadas(exercicio);
  console.log(`Exercício ${r.exercicio}: ${r.noEspelho} emendas no espelho, ${r.gravadas} da Rede Federal gravadas (${r.diretas} diretas, ${r.viaMec} pelo MEC), ${reais.format(r.total)}.`);
  for (const s of r.semInstituicao) console.log(`  AVISO: unidade sem instituição no cadastro: ${s}`);
  for (const s of r.autoresSemPartido) console.log(`  AVISO: autor sem partido nas listas oficiais: ${s}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
