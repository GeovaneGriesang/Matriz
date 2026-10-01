/**
 * A edição 2026 da PNP renomeou rótulos no painel de pessoal ("TAEs" no lugar de "Servidores | Número de TAE", etc.).
 * Compara os NÚMEROS do ano-base 2024 entre as duas edições, ignorando o rótulo: os valores mudaram ou só o nome?
 */
import { prisma } from "../src/server/db/prisma";

async function carregar(ciclo: number, subaba: string) {
  const linhas = await prisma.pnpFato.findMany({
    where: { anoBase: 2024, subaba, fonteDados: { cicloOrcamento: ciclo } },
    select: { estruturaId: true, dimensao: true, valorDimensao: true, categoria: true, valores: true },
  });
  const m = new Map<string, number[]>();
  for (const l of linhas) {
    const nums = Object.values(l.valores as Record<string, unknown>).filter((v): v is number => typeof v === "number").sort((x, y) => x - y);
    m.set(`${l.estruturaId}|${l.dimensao}|${l.valorDimensao}|${l.categoria}`, nums);
  }
  return m;
}

async function main() {
  for (const subaba of ["Docentes", "Técnicos-administrativos"]) {
    const a = await carregar(2026, subaba);
    const b = await carregar(2027, subaba);
    let iguais = 0;
    let difere = 0;
    let exemplo = "";
    for (const [k, va] of a) {
      const vb = b.get(k);
      if (!vb) continue;
      if (va.length === vb.length && va.every((x, i) => Math.abs(x - vb[i]!) < 1e-9)) iguais++;
      else {
        difere++;
        if (!exemplo) exemplo = `${k}: 2026=${va.join(",")} 2027=${vb.join(",")}`;
      }
    }
    console.log(`${subaba}: ${iguais} linhas com os mesmos números, ${difere} com números diferentes. ${exemplo}`);
  }
  await prisma.$disconnect();
}
main();
