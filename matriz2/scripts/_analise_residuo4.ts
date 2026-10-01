/**
 * Decifra os resíduos da Matrícula Total usando só a própria 6ª fase (DB): da Matrícula Total publicada tira-se o
 * "fator de CH e peso" que a MDO realmente aplicou, e compara-se com o que a regra usa.
 */
import { prisma } from "../src/server/db/prisma";
import { diasAtivosNoPeriodo, icqaDoCiclo, diasDoCiclo, chEfetiva, type CicloParaCalculo } from "../src/lib/mdo/matriculaTotal";

const periodo = { inicio: new Date(Date.UTC(2025, 0, 1)), fim: new Date(Date.UTC(2025, 11, 31)) };

async function main() {
  const mdo = await prisma.distribuicaoCiclo.findMany({
    where: { ano: 2027, unidade: { instituicao: { sigla: { not: "IFSUL" } } } },
    select: {
      codigoCiclo: true, curso: true, tipoCurso: true, tipoOferta: true, pesoCursoMatriz: true, chMinimaMec: true, cargaHoraria: true,
      chMatriz: true, fonteFinanciamento: true, modalidade: true, repasse: true, turno: true, nivel: true, qtdAlunosMatriz: true, matriculaTotal: true, inicio: true, termino: true, jubilamento: true, areaEixo: true,
      unidade: { select: { instituicao: { select: { sigla: true } } } },
    },
  });
  type L = { f: Record<string, string>; razao: number };
  const todas: { classe: string; mec: number; peso: number; l: L }[] = [];
  for (const m of mdo) {
    if (!m.inicio || !m.termino || !m.jubilamento) continue;
    const alunos = Number(m.qtdAlunosMatriz ?? 0);
    const mt = Number(m.matriculaTotal);
    const c: CicloParaCalculo = { inicio: m.inicio, termino: m.termino, jubilamento: m.jubilamento, chCiclo: m.cargaHoraria ?? 0, chMec: m.chMinimaMec ?? 0, chMatriz: m.chMatriz ?? 0, peso: Number(m.pesoCursoMatriz), agropecuaria: false, alunos };
    const icqa = icqaDoCiclo(c, periodo);
    const ativos = diasAtivosNoPeriodo(c, periodo);
    const dc = diasDoCiclo(c);
    if (alunos === 0 || icqa === 0 || ativos === 0) continue;
    const chPeso = (mt * 800) / ((alunos * icqa * ativos) / dc);
    const razao = Math.round((chPeso / (chEfetiva(c) * Number(m.pesoCursoMatriz))) * 1000) / 1000;
    const classe = `${m.tipoCurso}|${m.tipoOferta}`;
    todas.push({ classe, mec: m.chMinimaMec ?? 0, peso: Number(m.pesoCursoMatriz), l: { razao, f: {
      fonte: m.fonteFinanciamento, modalidade: m.modalidade, repasse: m.repasse, turno: m.turno ?? "", nivel: m.nivel ?? "", eixo: m.areaEixo ?? "", oferta: m.tipoOferta ?? "",
      chcVsChm: (m.cargaHoraria ?? 0) > (m.chMatriz ?? 0) ? "chc>chm" : (m.cargaHoraria ?? 0) === (m.chMatriz ?? 0) ? "chc=chm" : "chc<chm",
      duracao: dc <= 365 ? "<=1a" : dc <= 730 ? "<=2a" : "mais",
      ano: String(m.inicio.getUTCFullYear()), inst: m.unidade.instituicao.sigla, curso: m.curso,
    } } });
  }
  function melhores(titulo: string, linhas: { l: L }[]) {
    const pureza: [string, number][] = [];
    const chaves = Object.keys(linhas[0]?.l.f ?? {});
    for (const k of chaves) {
      const mm = new Map<string, Map<number, number>>();
      for (const x of linhas) { const v = x.l.f[k]!; const r = mm.get(v) ?? new Map<number, number>(); r.set(x.l.razao, (r.get(x.l.razao) ?? 0) + 1); mm.set(v, r); }
      let certos = 0;
      for (const r of mm.values()) certos += Math.max(...r.values());
      pureza.push([`${k} (${mm.size} valores)`, certos / linhas.length]);
    }
    console.log(titulo, "n=" + linhas.length, pureza.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, p]) => `${k}: ${(p * 100).toFixed(1)}%`).join(" | "));
  }
  melhores("FIC mec=3200", todas.filter((x) => x.classe.startsWith("QUALIFICACAO") && x.mec === 3200));
  melhores("Lato sensu peso 2.5", todas.filter((x) => x.classe.startsWith("ESPECIALIZACAO (LATO") && x.peso === 2.5));
  melhores("Stricto", todas.filter((x) => (x.classe.startsWith("MESTRADO") || x.classe.startsWith("DOUTORADO")) && x.l.razao !== 1.5));
  melhores("Longos chc>chm peso 2", todas.filter((x) => (x.classe.startsWith("BACHARELADO") || x.classe.startsWith("ENSINO FUND")) && x.peso === 2 && x.l.f.chcVsChm === "chc>chm"));
  const fic = todas.filter((x) => x.classe.startsWith("QUALIFICACAO") && x.mec === 3200);
  const porFonte = new Map<string, Map<number, number>>();
  for (const x of fic) { const r = porFonte.get(x.l.f.fonte!) ?? new Map<number, number>(); r.set(x.l.razao, (r.get(x.l.razao) ?? 0) + 1); porFonte.set(x.l.f.fonte!, r); }
  console.log("FIC mec=3200 por fonte:", [...porFonte].map(([k, r]) => k + " " + [...r].map(([a, b]) => a + ":" + b).join("/")).join(" | "));
  await prisma.$disconnect();
}
main();
