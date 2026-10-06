/**
 * Carga dos dados da PNP baixados à mão (pasta `CSV da PNP/Manual/<ciclo>`).
 *
 * Uso:
 *   npm run carregar:pnp -- 2027                       tudo, na ordem abaixo
 *   npm run carregar:pnp -- 2027 --so=ensino,pessoal   só algumas partes
 *
 * Partes: ensino, pessoal, orcamento (painéis, selo "PNP - Extração manual"), extrator (tabelas planas) e
 * microdados (matrículas e eficiência por ciclo, servidores, financeiro).
 *
 * É separada de `npm run carregar` de propósito: são dezenas de milhões de linhas lidas e não dependem das
 * exportações da MDO. Rodar de novo só refaz o que mudou (cada parte confere o SHA-256 dos arquivos), então
 * pode ser repetida a cada arquivo novo baixado.
 */
import { prisma } from "../src/server/db/prisma";
import { carregarPnpManual } from "../src/carga/carregarPnpManual";
import { carregarPnpOrcamento } from "../src/carga/carregarPnpOrcamento";
import { carregarPnpExtrator } from "../src/carga/carregarPnpExtrator";
import { carregarPnpMicrodados } from "../src/carga/carregarPnpMicrodados";
import { recalcularOpcoesPnp } from "../src/server/queries/opcoesPnp";

const inteiro = new Intl.NumberFormat("pt-BR");
const PARTES = ["ensino", "pessoal", "orcamento", "extrator", "microdados"] as const;
type Parte = (typeof PARTES)[number];

function titulo(texto: string) {
  console.log(`\n${"=".repeat(72)}\n${texto}\n${"=".repeat(72)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const ciclos = args.map(Number).filter((n) => Number.isInteger(n));
  const so = args.find((a) => a.startsWith("--so="))?.slice(5).split(",") as Parte[] | undefined;
  const partes = so ?? [...PARTES];
  if (ciclos.length === 0) {
    console.error("Informe o ciclo (a pasta). Exemplo: npm run carregar:pnp -- 2027");
    process.exit(1);
  }
  const log = (m: string) => console.log(m);

  for (const ciclo of ciclos) {
    for (const painel of ["ensino", "pessoal"] as const) {
      if (!partes.includes(painel)) continue;
      titulo(`PNP, EXTRAÇÃO MANUAL, painel ${painel === "ensino" ? "Dados de Ensino" : "Dados de Pessoal"}, pasta ${ciclo}`);
      const r = await carregarPnpManual(ciclo, log, painel === "ensino" ? "ENSINO" : "PESSOAL");
      if (!r) {
        console.log("  Pasta não encontrada.");
        continue;
      }
      for (const g of r.grupos) {
        console.log(`  ${g.aba} / ${g.subaba}: ${g.arquivos} arquivo(s), ${inteiro.format(g.linhas)} linhas${g.ignoradas ? `, ${g.ignoradas} ignoradas` : ""} [${g.situacao}]`);
      }
      console.log(`  estruturas: ${inteiro.format(r.estruturas)} (instituições ligadas: ${r.estruturasLigadasAInstituicao}, câmpus ligados a uma unidade: ${r.estruturasLigadasAUnidade}, câmpus sem vínculo: ${r.campusNaoLigados})`);
      for (const a of r.avisos) console.log(`  AVISO: ${a}`);
    }

    if (partes.includes("orcamento")) {
      titulo(`PNP, EXTRAÇÃO MANUAL, painel Dados Orçamentários, pasta ${ciclo}`);
      const o = await carregarPnpOrcamento(ciclo, log);
      if (!o) console.log("  Pasta não encontrada.");
      else {
        for (const g of o.grupos) {
          console.log(`  ${g.aba} / ${g.subaba}: ${g.arquivos} arquivo(s), ${inteiro.format(g.linhas)} linhas${g.ignoradas ? `, ${g.ignoradas} ignoradas` : ""} [${g.situacao}]`);
        }
        for (const a of o.avisos) console.log(`  AVISO: ${a}`);
      }
    }

    if (partes.includes("extrator")) {
      titulo(`PNP, EXTRATOR, pasta ${ciclo}`);
      const e = await carregarPnpExtrator(ciclo, log);
      if (!e) console.log("  Pasta não encontrada.");
      else for (const t of e.tabelas) console.log(`  ${t.grupo} / ${t.tabela}: ${inteiro.format(t.linhas)} linhas [${t.situacao}]`);
    }

    if (partes.includes("microdados")) {
      titulo(`PNP, MICRODADOS, pasta ${ciclo}`);
      const m = await carregarPnpMicrodados(ciclo, log);
      if (!m) console.log("  Pasta não encontrada.");
      else {
        for (const r of m.resultados) {
          console.log(`  ${r.tipo} ${r.ano}: ${inteiro.format(r.linhasLidas)} lidas, ${inteiro.format(r.linhasGravadas)} gravadas [${r.situacao}]`);
        }
      }
    }

    // As telas de ensino e de orçamento listam as aberturas dos filtros a partir de uma tabela pequena; refaz-se aqui, depois da carga.
    if (partes.includes("ensino") || partes.includes("pessoal") || partes.includes("orcamento")) {
      titulo(`PNP, opções dos filtros das telas, edição ${ciclo}`);
      await recalcularOpcoesPnp(ciclo, (m) => console.log(m));
    }
  }
  await prisma.$disconnect();
  console.log("\nCarga concluída.\n");
}

main().catch(async (erro) => {
  console.error("\nFalhou:", erro instanceof Error ? erro.message : erro);
  await prisma.$disconnect();
  process.exit(1);
});
