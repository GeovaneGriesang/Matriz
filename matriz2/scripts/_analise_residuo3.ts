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
      chMatriz: true, qtdAlunosMatriz: true, matriculaTotal: true, inicio: true, termino: true, jubilamento: true, areaEixo: true,
      unidade: { select: { instituicao: { select: { sigla: true } } } },
    },
  });
  type Linha = { classe: string; inst: string; mec: number; chc: number; razao: number; pesoCol: number; oferta: string; chm: number; dc: number; ativos: number };
  const linhas: Linha[] = [];
  for (const m of mdo) {
    if (!m.inicio || !m.termino || !m.jubilamento) continue;
    const alunos = Number(m.qtdAlunosMatriz ?? 0);
    const mt = Number(m.matriculaTotal);
    const c: CicloParaCalculo = { inicio: m.inicio, termino: m.termino, jubilamento: m.jubilamento, chCiclo: m.cargaHoraria ?? 0, chMec: m.chMinimaMec ?? 0, chMatriz: m.chMatriz ?? 0, peso: Number(m.pesoCursoMatriz), agropecuaria: false, alunos };
    const icqa = icqaDoCiclo(c, periodo);
    const ativos = diasAtivosNoPeriodo(c, periodo);
    const dc = diasDoCiclo(c);
    if (alunos === 0 || icqa === 0 || ativos === 0) continue;
    const base = (alunos * icqa * ativos) / dc;
    const chPeso = (mt * 800) / base;
    const razaoCh = chPeso / (chEfetiva(c) * Number(m.pesoCursoMatriz));
    linhas.push({ classe: `${m.tipoCurso}|${m.tipoOferta}`, inst: m.unidade.instituicao.sigla, mec: m.chMinimaMec ?? 0, chc: m.cargaHoraria ?? 0, razao: Math.round(razaoCh * 1000) / 1000, pesoCol: Number(m.pesoCursoMatriz), oferta: m.tipoOferta ?? "", chm: m.chMatriz ?? 0, dc, ativos });
  }
  const conta = (f: (l: Linha) => boolean, rot: (l: Linha) => string) => { const mm = new Map<string, number>(); for (const l of linhas.filter(f)) mm.set(rot(l), (mm.get(rot(l)) ?? 0) + 1); return [...mm].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, v]) => k + ": " + v).join(" | "); };
  console.log("FIC: razão por (mec==3200?)", conta((l) => l.classe.startsWith("QUALIFICACAO"), (l) => `mec${l.mec === 3200 ? "=3200" : "!=3200"} razao ${l.razao}`));
  console.log("FIC com mec=3200: razão por instituição", conta((l) => l.classe.startsWith("QUALIFICACAO") && l.mec === 3200, (l) => `${l.inst} ${l.razao}`));
  console.log("FIC, razão 2.5: peso da coluna", conta((l) => l.classe.startsWith("QUALIFICACAO") && l.razao === 2.5, (l) => `peso ${l.pesoCol}`));
  console.log("Lato sensu: razão por instituição", conta((l) => l.classe.startsWith("ESPECIALIZACAO (LATO"), (l) => `${l.inst} ${l.razao}`));
  console.log("Lato sensu: razão por (peso da coluna, ch do ciclo vs matriz)", conta((l) => l.classe.startsWith("ESPECIALIZACAO (LATO"), (l) => `peso ${l.pesoCol} razao ${l.razao}`));
  console.log("Stricto: razão", conta((l) => l.classe.startsWith("MESTRADO") || l.classe.startsWith("DOUTORADO"), (l) => `${l.classe.split("|")[0]} razao ${l.razao}`));
  console.log("Stricto razão != 1: instituição", conta((l) => (l.classe.startsWith("MESTRADO") || l.classe.startsWith("DOUTORADO")) && l.razao !== 1, (l) => l.inst));
  console.log("Longos (chc>3200, dc>1400): razão", conta((l) => l.dc > 1400 && l.chc > l.chm && !l.classe.startsWith("QUALIF"), (l) => `${l.classe.split("|")[0]} peso ${l.pesoCol} razao ${l.razao}`));
  await prisma.$disconnect();
}
main();
