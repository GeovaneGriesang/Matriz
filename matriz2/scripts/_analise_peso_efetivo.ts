/**
 * O peso que a MDO realmente aplicou (peso x bônus de agropecuária), deduzido da Matrícula Total publicada, é função do
 * curso? Mede a pureza desse "peso efetivo" por várias chaves, na 6ª fase da rede de 2027 (sem o IFSul, que vem do Excel).
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
      unidade: { select: { instituicaoId: true } },
    },
  });
  type R = { tipo: string; oferta: string; curso: string; eixo: string; inst: number; mec: number; peso: number; efetivo: number };
  const rs: R[] = [];
  for (const m of mdo) {
    if (!m.inicio || !m.termino || !m.jubilamento) continue;
    const alunos = Number(m.qtdAlunosMatriz ?? 0);
    const c: CicloParaCalculo = { inicio: m.inicio, termino: m.termino, jubilamento: m.jubilamento, chCiclo: m.cargaHoraria ?? 0, chMec: m.chMinimaMec ?? 0, chMatriz: m.chMatriz ?? 0, peso: 1, agropecuaria: false, alunos };
    const icqa = icqaDoCiclo(c, periodo);
    const ativos = diasAtivosNoPeriodo(c, periodo);
    if (alunos === 0 || icqa === 0 || ativos === 0) continue;
    const base = (alunos * icqa * ativos) / diasDoCiclo(c);
    const ch = chEfetiva(c);
    if (ch <= 0) continue;
    const efetivo = Math.round(((Number(m.matriculaTotal) * 800) / base / ch) * 1000) / 1000;
    rs.push({ tipo: m.tipoCurso ?? "", oferta: m.tipoOferta ?? "", curso: m.curso, eixo: m.areaEixo ?? "", inst: m.unidade.instituicaoId, mec: m.chMinimaMec ?? 0, peso: Number(m.pesoCursoMatriz), efetivo });
  }
  console.log("ciclos analisados", rs.length);
  function pureza(rotulo: string, chave: (r: R) => string) {
    const mm = new Map<string, Map<number, number>>();
    for (const r of rs) { const k = chave(r); const x = mm.get(k) ?? new Map<number, number>(); x.set(r.efetivo, (x.get(r.efetivo) ?? 0) + 1); mm.set(k, x); }
    let certos = 0;
    for (const x of mm.values()) certos += Math.max(...x.values());
    console.log(`${rotulo}: ${mm.size} chaves, acerta ${((certos / rs.length) * 100).toFixed(2)}% (${rs.length - certos} erros)`);
  }
  pureza("peso EFETIVO por (tipo, oferta, curso)", (r) => `${r.tipo}|${r.oferta}|${r.curso}`);
  pureza("peso EFETIVO por (tipo, curso)", (r) => `${r.tipo}|${r.curso}`);
  pureza("peso EFETIVO por (tipo, oferta, curso, CH MEC)", (r) => `${r.tipo}|${r.oferta}|${r.curso}|${r.mec}`);
  pureza("peso EFETIVO por (tipo, oferta, curso, instituição)", (r) => `${r.tipo}|${r.oferta}|${r.curso}|${r.inst}`);
  // Regra do FIC: CH MEC 3200 vale peso 2,5.
  const outros = rs.filter((r) => !(r.tipo.startsWith("QUALIFICACAO") && r.mec === 3200));
  const fic3200 = rs.filter((r) => r.tipo.startsWith("QUALIFICACAO") && r.mec === 3200);
  console.log("FIC com CH MEC 3200:", fic3200.length, "com peso efetivo 2,5:", fic3200.filter((r) => r.efetivo === 2.5).length);
  const dist = new Map<string, number>();
  for (const r of outros) { const k = `${r.efetivo}`; dist.set(k, (dist.get(k) ?? 0) + 1); }
  console.log("distribuição do peso efetivo (fora FIC 3200):", [...dist].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join("  "));
  const distCol = new Map<string, number>();
  for (const r of rs.filter((r) => r.efetivo !== r.peso && r.efetivo !== r.peso * 1.5)) { const k = `${r.tipo.split(" ")[0]} col ${r.peso} efetivo ${r.efetivo}`; distCol.set(k, (distCol.get(k) ?? 0) + 1); }
  console.log("coluna diferente do efetivo (sem contar agro):", [...distCol].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}:${v}`).join(" | "));
  await prisma.$disconnect();
}
main();
