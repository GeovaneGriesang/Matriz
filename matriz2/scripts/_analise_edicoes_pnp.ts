/**
 * Compara o ano-base 2024 nas duas edições da PNP carregadas (ciclo 2026 = edição 2026; ciclo 2027 = edição 2027).
 * A PNP revisa os números entre edições: quanto mudou, em quais tabelas, e o que só existe numa das duas?
 *
 * Uso: npx tsx scripts/_analise_edicoes_pnp.ts
 */
import { prisma } from "../src/server/db/prisma";

const ANO_BASE = 2024;

type Valores = Record<string, number | string>;

function chave(l: { estruturaId: number; aba: string; subaba: string; dimensao: string; valorDimensao: string; categoria: string }) {
  return `${l.estruturaId}|${l.aba}|${l.subaba}|${l.dimensao}|${l.valorDimensao}|${l.categoria}`;
}

async function carregar(ciclo: number, subaba: string) {
  const linhas = await prisma.pnpFato.findMany({
    where: { anoBase: ANO_BASE, subaba, fonteDados: { cicloOrcamento: ciclo } },
    select: { estruturaId: true, aba: true, subaba: true, dimensao: true, valorDimensao: true, categoria: true, valores: true },
  });
  const m = new Map<string, Valores>();
  for (const l of linhas) m.set(chave(l), l.valores as Valores);
  return { m, repetidas: linhas.length - m.size };
}

async function main() {
  const subabas = (
    await prisma.pnpFato.groupBy({ by: ["aba", "subaba"], where: { anoBase: ANO_BASE, fonteDados: { cicloOrcamento: 2026 } } })
  ).sort((a, b) => `${a.aba}${a.subaba}`.localeCompare(`${b.aba}${b.subaba}`));

  console.log(`Ano-base ${ANO_BASE}: edição 2026 contra edição 2027\n`);
  console.log("subaba | só 2026 | só 2027 | em ambas | iguais | valores diferentes | repetidas");
  const porMetrica = new Map<string, { n: number; difere: number }>();
  let totalAmbas = 0;
  let totalIguais = 0;
  for (const s of subabas) {
    const a = await carregar(2026, s.subaba);
    const b = await carregar(2027, s.subaba);
    let soA = 0;
    let soB = 0;
    let ambas = 0;
    let iguais = 0;
    for (const [k, va] of a.m) {
      const vb = b.m.get(k);
      if (!vb) {
        soA++;
        continue;
      }
      ambas++;
      let igual = true;
      for (const r of new Set([...Object.keys(va), ...Object.keys(vb)])) {
        const x = va[r];
        const y = vb[r];
        const dif = typeof x === "number" && typeof y === "number" ? Math.abs(x - y) > 1e-9 : x !== y;
        const met = porMetrica.get(`${s.subaba} :: ${r}`) ?? { n: 0, difere: 0 };
        met.n++;
        if (dif) {
          met.difere++;
          igual = false;
        }
        porMetrica.set(`${s.subaba} :: ${r}`, met);
      }
      if (igual) iguais++;
    }
    for (const k of b.m.keys()) if (!a.m.has(k)) soB++;
    totalAmbas += ambas;
    totalIguais += iguais;
    console.log(`${s.aba} / ${s.subaba} | ${soA} | ${soB} | ${ambas} | ${iguais} | ${ambas - iguais} | ${a.repetidas}/${b.repetidas}`);
  }
  console.log(`\nTotal em ambas: ${totalAmbas}, idênticas: ${totalIguais} (${((totalIguais / Math.max(1, totalAmbas)) * 100).toFixed(2)}%)`);
  const piores = [...porMetrica].filter(([, v]) => v.difere > 0).sort((x, y) => y[1].difere - x[1].difere).slice(0, 15);
  console.log("\nMétricas que mais mudaram entre as edições:");
  for (const [k, v] of piores) console.log(`  ${k}: ${v.difere} de ${v.n} (${((v.difere / v.n) * 100).toFixed(1)}%)`);
  await prisma.$disconnect();
}

main();
