/** FIC com CH mínima 3200 na MDO: o que, nos campos da PNP, separa os ciclos de peso efetivo 2,5 dos de peso 1? */
import { prisma } from "../src/server/db/prisma";
import { diasAtivosNoPeriodo, icqaDoCiclo, diasDoCiclo, chEfetiva, type CicloParaCalculo } from "../src/lib/mdo/matriculaTotal";

const periodo = { inicio: new Date(Date.UTC(2025, 0, 1)), fim: new Date(Date.UTC(2025, 11, 31)) };

async function main() {
  const mdo = await prisma.distribuicaoCiclo.findMany({
    where: { ano: 2027, tipoCurso: { startsWith: "QUALIFICACAO" }, chMinimaMec: 3200, unidade: { instituicao: { sigla: { not: "IFSUL" } } } },
    select: { codigoCiclo: true, cargaHoraria: true, chMatriz: true, pesoCursoMatriz: true, chMinimaMec: true, qtdAlunosMatriz: true, matriculaTotal: true, inicio: true, termino: true, jubilamento: true, curso: true, tipoOferta: true },
  });
  const pnp = await prisma.pnpMicrodadoCiclo.findMany({
    where: { tipo: "MATRICULAS", anoBase: 2025, tipoCurso: { startsWith: "Qualifica" } },
    select: { ciclo: true, nomeCurso: true, eixo: true, subeixo: true, programa: true, cargaHorariaMinima: true, cargaHoraria: true, fatorEsforco: true, modalidade: true, turno: true, cursoEmec: true, formacaoProfessores: true, instituicao: true, tipoOferta: true, fonteFinanciamento: true, vagas: true },
  });
  const porCiclo = new Map(pnp.map((p) => [p.ciclo, p]));
  type Ex = { razao: number; f: Record<string, string> };
  const linhas: Ex[] = [];
  for (const m of mdo) {
    const p = porCiclo.get(m.codigoCiclo);
    if (!p || !m.inicio || !m.termino || !m.jubilamento) continue;
    const alunos = Number(m.qtdAlunosMatriz ?? 0);
    const c: CicloParaCalculo = { inicio: m.inicio, termino: m.termino, jubilamento: m.jubilamento, chCiclo: m.cargaHoraria ?? 0, chMec: 3200, chMatriz: m.chMatriz ?? 0, peso: 1, agropecuaria: false, alunos };
    const icqa = icqaDoCiclo(c, periodo);
    const ativos = diasAtivosNoPeriodo(c, periodo);
    if (alunos === 0 || icqa === 0 || ativos === 0) continue;
    const base = (alunos * icqa * ativos) / diasDoCiclo(c);
    const razao = Math.round(((Number(m.matriculaTotal) * 800) / base / chEfetiva(c)) * 1000) / 1000;
    linhas.push({ razao, f: {
      nomeCurso: p.nomeCurso, eixo: p.eixo, subeixo: p.subeixo, programa: p.programa, chMinPnp: String(p.cargaHorariaMinima), chc: String(p.cargaHoraria),
      fec: String(p.fatorEsforco), modalidade: p.modalidade, turno: p.turno, emec: p.cursoEmec ? "tem" : "nao", formacao: String(p.formacaoProfessores),
      oferta: p.tipoOferta, fonte: p.fonteFinanciamento, vagas: String(p.vagas), nomeMdo: m.curso,
    } });
  }
  console.log("ciclos", linhas.length, "razões", [...new Set(linhas.map((l) => l.razao))].slice(0, 6));
  const pureza: [string, number, number][] = [];
  for (const k of Object.keys(linhas[0]!.f)) {
    const mm = new Map<string, Map<number, number>>();
    for (const x of linhas) { const v = x.f[k]!; const r = mm.get(v) ?? new Map<number, number>(); r.set(x.razao, (r.get(x.razao) ?? 0) + 1); mm.set(v, r); }
    let certos = 0;
    for (const r of mm.values()) certos += Math.max(...r.values());
    pureza.push([k, certos / linhas.length, mm.size]);
  }
  console.log(pureza.sort((a, b) => b[1] - a[1]).map(([k, p, n]) => `${k} (${n} valores): ${(p * 100).toFixed(1)}%`).join("\n"));
  await prisma.$disconnect();
}
main();
