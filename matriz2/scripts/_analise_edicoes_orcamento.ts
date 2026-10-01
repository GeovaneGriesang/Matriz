/**
 * Compara o ano-base 2024 do painel Dados Orçamentários nas duas edições da PNP (ciclo 2026 e ciclo 2027),
 * por subaba, comparando só os números (a edição pode ter renomeado rótulos).
 */
import { prisma } from "../src/server/db/prisma";

async function carregar(ciclo: number, subaba: string) {
  const linhas = await prisma.pnpOrcamentoFato.findMany({
    where: { anoBase: 2024, subaba, fonteDados: { cicloOrcamento: ciclo } },
    select: { estruturaId: true, aba: true, dimensao: true, valorDimensao: true, relacaoOrgao: true, mes: true, tipoValor: true, valores: true },
  });
  const m = new Map<string, number[]>();
  for (const l of linhas) {
    const nums = Object.values(l.valores as Record<string, unknown>).filter((v): v is number => typeof v === "number").sort((x, y) => x - y);
    m.set(`${l.estruturaId}|${l.aba}|${l.dimensao}|${l.valorDimensao}|${l.relacaoOrgao}|${l.mes}|${l.tipoValor}`, nums);
  }
  return { m, total: linhas.length };
}

async function main() {
  const subabas = await prisma.pnpOrcamentoFato.groupBy({ by: ["aba", "subaba"], where: { anoBase: 2024, fonteDados: { cicloOrcamento: 2026 } } });
  console.log("subaba | linhas 2026 | linhas 2027 | em ambas | mesmos números | diferentes");
  for (const s of subabas.sort((a, b) => `${a.aba}${a.subaba}`.localeCompare(`${b.aba}${b.subaba}`))) {
    const a = await carregar(2026, s.subaba);
    const b = await carregar(2027, s.subaba);
    let ambas = 0, iguais = 0, exemplo = "";
    for (const [k, va] of a.m) {
      const vb = b.m.get(k);
      if (!vb) continue;
      ambas++;
      if (va.length === vb.length && va.every((x, i) => Math.abs(x - vb[i]!) < 0.005)) iguais++;
      else if (!exemplo) exemplo = `${k}: 2026=${va.join(",")} 2027=${vb.join(",")}`;
    }
    console.log(`${s.aba} / ${s.subaba} | ${a.total} | ${b.total} | ${ambas} | ${iguais} | ${ambas - iguais} ${exemplo}`);
  }
  await prisma.$disconnect();
}
main();
