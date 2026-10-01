import { prisma } from "../src/server/db/prisma";

async function main() {
  const mdo = await prisma.distribuicaoCiclo.findMany({
    where: { ano: 2027 },
    select: { codigoCiclo: true, curso: true, tipoCurso: true, tipoOferta: true, areaEixo: true, pesoCursoMatriz: true, unidade: { select: { instituicaoId: true } } },
  });
  type L = (typeof mdo)[number];
  function acuracia(rotulo: string, chave: (x: L) => string) {
    const m = new Map<string, Map<number, number>>();
    for (const x of mdo) {
      const k = chave(x);
      const mm = m.get(k) ?? new Map<number, number>();
      const p = Number(x.pesoCursoMatriz);
      mm.set(p, (mm.get(p) ?? 0) + 1);
      m.set(k, mm);
    }
    let certos = 0;
    let deterministicas = 0;
    for (const mm of m.values()) {
      const total = [...mm.values()].reduce((s, v) => s + v, 0);
      certos += Math.max(...mm.values());
      if (mm.size === 1) deterministicas += total;
    }
    console.log(`${rotulo}: ${m.size} chaves; acerta ${certos} de ${mdo.length} (${((certos / mdo.length) * 100).toFixed(1)}%) pela moda; ${deterministicas} em chaves sem ambiguidade`);
  }
  acuracia("(tipo, curso)", (x) => `${x.tipoCurso}|${x.curso}`);
  acuracia("(tipo, oferta, curso)", (x) => `${x.tipoCurso}|${x.tipoOferta}|${x.curso}`);
  acuracia("(tipo, oferta, curso, instituicao)", (x) => `${x.tipoCurso}|${x.tipoOferta}|${x.curso}|${x.unidade.instituicaoId}`);
  acuracia("(tipo, oferta, eixo)", (x) => `${x.tipoCurso}|${x.tipoOferta}|${x.areaEixo}`);
  acuracia("(tipo, oferta)", (x) => `${x.tipoCurso}|${x.tipoOferta}`);
  const dist = new Map<string, number>();
  for (const x of mdo) { const k = `${x.tipoCurso}|${Number(x.pesoCursoMatriz)}`; dist.set(k, (dist.get(k) ?? 0) + 1); }
  console.log([...dist].sort().map(([k, v]) => `${k}:${v}`).join("  "));
  await prisma.$disconnect();
}
main();
