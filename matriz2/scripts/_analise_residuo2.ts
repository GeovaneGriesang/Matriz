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
  const grupos = new Map<string, Map<string, { n: number; ex: string }>>();
  let ok = 0, erro = 0;
  for (const m of mdo) {
    if (!m.inicio || !m.termino || !m.jubilamento) continue;
    const alunos = Number(m.qtdAlunosMatriz ?? 0);
    const mt = Number(m.matriculaTotal);
    const c: CicloParaCalculo = {
      inicio: m.inicio, termino: m.termino, jubilamento: m.jubilamento, chCiclo: m.cargaHoraria ?? 0, chMec: m.chMinimaMec ?? 0,
      chMatriz: m.chMatriz ?? 0, peso: Number(m.pesoCursoMatriz), agropecuaria: false, alunos,
    };
    const icqa = icqaDoCiclo(c, periodo);
    const ativos = diasAtivosNoPeriodo(c, periodo);
    const dc = diasDoCiclo(c);
    if (alunos === 0 || icqa === 0 || ativos === 0) continue;
    const base = (alunos * icqa * ativos) / dc; // alunos efetivos
    const chPeso = (mt * 800) / base; // = peso * agro * CH efetiva realmente usados
    const chRegra = chEfetiva(c);
    const pesoRegra = Number(m.pesoCursoMatriz);
    const razao = chPeso / (chRegra * pesoRegra);
    // Aceita bônus de agropecuária (1,5) como "certo".
    if (Math.abs(razao - 1) < 1e-3 || Math.abs(razao - 1.5) < 1e-3) { ok++; continue; }
    erro++;
    const tipo = `${m.tipoCurso}|${m.tipoOferta}`;
    const chaveRazao = razao.toFixed(3);
    const g = grupos.get(tipo) ?? new Map<string, { n: number; ex: string }>();
    const atual = g.get(chaveRazao) ?? { n: 0, ex: "" };
    atual.n++;
    if (!atual.ex) {
      atual.ex = `${m.codigoCiclo} ${m.unidade.instituicao.sigla} ${m.curso.slice(0, 26)} chc=${m.cargaHoraria} mec=${m.chMinimaMec} chm=${m.chMatriz} peso=${pesoRegra} dc=${dc} ativos=${ativos} icqa=${icqa} alunos=${alunos} chPeso=${chPeso.toFixed(1)}`;
    }
    g.set(chaveRazao, atual);
    grupos.set(tipo, g);
  }
  console.log({ ok, erro });
  for (const [tipo, g] of [...grupos].sort((a, b) => [...b[1].values()].reduce((s, x) => s + x.n, 0) - [...a[1].values()].reduce((s, x) => s + x.n, 0)).slice(0, 8)) {
    console.log(tipo);
    for (const [r, v] of [...g].sort((a, b) => b[1].n - a[1].n).slice(0, 4)) console.log(`   razão ${r} x${v.n}   ex: ${v.ex}`);
  }
  await prisma.$disconnect();
}
main();
