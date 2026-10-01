/** O que, nos campos da PNP, prevê a CH mínima do MEC que a MDO usou? Pureza por campo, FIC e demais tipos. */
import { prisma } from "../src/server/db/prisma";

async function main() {
  const mdo = await prisma.distribuicaoCiclo.findMany({
    where: { ano: 2027, unidade: { instituicao: { sigla: { not: "IFSUL" } } } },
    select: { codigoCiclo: true, tipoCurso: true, tipoOferta: true, curso: true, chMinimaMec: true, cargaHoraria: true },
  });
  const pnp = await prisma.pnpMicrodadoCiclo.findMany({
    where: { tipo: "MATRICULAS", anoBase: 2025 },
    select: { ciclo: true, nomeCurso: true, eixo: true, subeixo: true, programa: true, cargaHorariaMinima: true, cargaHoraria: true, fatorEsforco: true, modalidade: true, turno: true, cursoEmec: true, tipoCurso: true, instituicao: true, fonteFinanciamento: true },
  });
  const porCiclo = new Map(pnp.map((p) => [p.ciclo, p]));
  type L = { mec: number; f: Record<string, string>; classe: string };
  const linhas: L[] = [];
  for (const m of mdo) {
    const p = porCiclo.get(m.codigoCiclo);
    if (!p) continue;
    const chc = p.cargaHoraria ?? 0;
    linhas.push({
      mec: m.chMinimaMec ?? 0,
      classe: m.tipoCurso ?? "",
      f: {
        nomeCursoPnp: p.nomeCurso, eixo: p.eixo, subeixo: p.subeixo, programa: p.programa, chMinPnp: String(p.cargaHorariaMinima), chc: String(chc),
        faixaChc: chc <= 40 ? "<=40" : chc <= 160 ? "<=160" : chc <= 400 ? "<=400" : chc <= 1000 ? "<=1000" : "mais",
        fec: String(p.fatorEsforco), modalidade: p.modalidade, turno: p.turno, emec: p.cursoEmec ? "tem" : "nao", oferta: m.tipoOferta ?? "",
        cursoMdo: m.curso, chMinPnpMaisCurso: `${p.cargaHorariaMinima}|${m.curso}`, chMinMaisFec: `${p.cargaHorariaMinima}|${p.fatorEsforco}`,
        cursoFec: `${m.curso}|${p.fatorEsforco}`, cursoOfertaChMin: `${m.tipoOferta}|${m.curso}|${p.cargaHorariaMinima}`,
        cursoOfertaFec: `${m.tipoOferta}|${m.curso}|${p.fatorEsforco}`,
      },
    });
  }
  function pureza(titulo: string, ls: L[]) {
    if (ls.length === 0) return;
    const res: [string, number, number][] = [];
    for (const k of Object.keys(ls[0]!.f)) {
      const mm = new Map<string, Map<number, number>>();
      for (const x of ls) { const v = x.f[k]!; const r = mm.get(v) ?? new Map<number, number>(); r.set(x.mec, (r.get(x.mec) ?? 0) + 1); mm.set(v, r); }
      let certos = 0;
      for (const r of mm.values()) certos += Math.max(...r.values());
      res.push([k, certos / ls.length, mm.size]);
    }
    console.log(`${titulo} n=${ls.length}: ` + res.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, p, n]) => `${k}(${n}) ${(p * 100).toFixed(1)}%`).join(" | "));
  }
  pureza("FIC", linhas.filter((l) => l.classe.startsWith("QUALIFICACAO")));
  pureza("Licenciatura", linhas.filter((l) => l.classe === "LICENCIATURA"));
  pureza("Técnico", linhas.filter((l) => l.classe === "TECNICO"));
  pureza("Bacharelado", linhas.filter((l) => l.classe === "BACHARELADO"));
  pureza("Todos", linhas);
  await prisma.$disconnect();
}
main();
