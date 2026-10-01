/**
 * Reconstrói a Matrícula Total de cada ciclo de 2027 SÓ a partir dos microdados da PNP de 2025 e de
 * tabelas pequenas, e compara com o que a MDO publicou. Mede quanto da conta já é derivável.
 *
 * Três níveis de "ajuda" da MDO, do mais para o menos:
 *   A) peso e CH MEC da própria MDO (isola o erro das demais regras: alunos, datas, jubilamento, ICQA);
 *   B) peso pelo valor mais comum de (tipo, oferta, curso) e CH MEC da PNP (o que se teria sem a MDO);
 *   C) igual a B, mas com a CH MEC aprendida pela moda de (tipo, curso) (tabela de CH mínima).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { prisma } from "../src/server/db/prisma";
import { AgregadorMatriculas, type CicloMicrodado } from "../src/lib/pnp/microdados";
import { matriculaTotalDoCiclo, type CicloParaCalculo } from "../src/lib/mdo/matriculaTotal";

const base =
  "C:/Users/USER/OneDrive/Documentos/IFSul/_Matriz orçamentária - CONIF/CSV da PNP/Manual/2027/Produtos de dados/Microdados";
const DIA = 86_400_000;

async function agregar(ano: number): Promise<Map<string, CicloMicrodado>> {
  const ag = new AgregadorMatriculas();
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(base, `microdados_matriculas_${ano}.csv.gz`)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const l of rl) ag.adicionar(l);
  const m = new Map<string, CicloMicrodado>();
  for (const c of ag.ciclos.values()) m.set(c.ciclo, c);
  return m;
}

function moda<T>(valores: T[]): T | undefined {
  const c = new Map<T, number>();
  for (const v of valores) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function chMatrizPorRegra(tipo: string, oferta: string, chc: number, mec: number): number {
  if (tipo.startsWith("QUALIFICACAO") || tipo === "DOUTORADO") return chc;
  if (oferta.includes("PROEJA")) return 2400;
  if (oferta === "INTEGRADO") return mec === 800 ? 3000 : mec === 1000 ? 3100 : mec === 1200 ? 3200 : mec;
  return mec;
}

async function main() {
  const ano = 2025;
  const pnp = await agregar(ano);
  const periodo = { inicio: new Date(Date.UTC(ano, 0, 1)), fim: new Date(Date.UTC(ano, 11, 31)) };
  const mdo = await prisma.distribuicaoCiclo.findMany({
    where: { ano: ano + 2 },
    select: {
      codigoCiclo: true, curso: true, tipoCurso: true, tipoOferta: true, pesoCursoMatriz: true, chMinimaMec: true,
      chMatriz: true, matriculaTotal: true, qtdAlunosMatriz: true, repasse: true,
    },
  });
  // Tabelas aprendidas da própria MDO (em amostra: servem para medir o quanto a regra se sustenta).
  // O PESO EFETIVO é o que reproduz a Matrícula Total publicada (a coluna de peso da exportação antiga nem sempre bate).
  type Linha = { m: (typeof mdo)[number]; p: CicloMicrodado; efetivo: number | null };
  const linhas: Linha[] = [];
  for (const m of mdo) {
    const p = pnp.get(m.codigoCiclo);
    if (!p || !p.inicio || !p.fimPrevisto) continue;
    const tipo = m.tipoCurso ?? "";
    const termino = new Date(p.fimPrevisto + "T00:00:00Z");
    const jub = new Date(termino.getTime() + (tipo.startsWith("QUALIFICACAO") ? 0 : 1095) * DIA);
    const alunos = jub.getTime() < periodo.inicio.getTime() ? 0 : p.matriculas;
    const chc = p.cargaHoraria ?? 0;
    const chm = chMatrizPorRegra(tipo, m.tipoOferta ?? "", chc, m.chMinimaMec ?? 0);
    const base = matriculaTotalDoCiclo({ inicio: new Date(p.inicio + "T00:00:00Z"), termino, jubilamento: jub, chCiclo: chc, chMec: m.chMinimaMec ?? 0, chMatriz: chm, peso: 1, agropecuaria: false, alunos }, periodo);
    linhas.push({ m, p, efetivo: base > 0 ? Math.round((Number(m.matriculaTotal) / base) * 1000) / 1000 : null });
  }
  const tabelaPeso = new Map<string, number>();
  const tabelaChMec = new Map<string, number>();
  {
    const g = new Map<string, number[]>();
    const h = new Map<string, number[]>();
    for (const l of linhas) {
      if (l.efetivo !== null) { const k = `${l.m.tipoCurso}|${l.m.tipoOferta}|${l.m.curso}|${l.m.chMinimaMec}`; g.set(k, [...(g.get(k) ?? []), l.efetivo]); }
      const k2 = `${l.m.tipoCurso}|${l.m.curso}|${l.p.cargaHorariaMinima}|${(l.m.tipoCurso ?? "").startsWith("LICEN") ? l.p.cargaHoraria : ""}`;
      h.set(k2, [...(h.get(k2) ?? []), l.m.chMinimaMec ?? 0]);
    }
    for (const [k, v] of g) tabelaPeso.set(k, moda(v)!);
    for (const [k, v] of h) tabelaChMec.set(k, moda(v)!);
  }
  const niveis: Record<string, { ok: number; soma: number }> = { "A  (peso da coluna, CH MEC da MDO)": { ok: 0, soma: 0 }, "A2 (peso EFETIVO por tabela, CH MEC da MDO)": { ok: 0, soma: 0 }, "B2 (peso EFETIVO por tabela, CH MEC por tabela da PNP)": { ok: 0, soma: 0 } };
  let total = 0, somaMdo = 0;
  for (const { m, p } of linhas) {
    total++;
    const mt = Number(m.matriculaTotal);
    somaMdo += mt;
    const tipo = m.tipoCurso ?? "";
    const oferta = m.tipoOferta ?? "";
    const termino = new Date(p.fimPrevisto + "T00:00:00Z");
    const jub = new Date(termino.getTime() + (tipo.startsWith("QUALIFICACAO") ? 0 : 1095) * DIA);
    const alunos = jub.getTime() < periodo.inicio.getTime() ? 0 : p.matriculas;
    const chc = p.cargaHoraria ?? 0;
    const calc = (peso: number, chMec: number) => matriculaTotalDoCiclo({ inicio: new Date(p.inicio + "T00:00:00Z"), termino, jubilamento: jub, chCiclo: chc, chMec, chMatriz: chMatrizPorRegra(tipo, oferta, chc, chMec), peso, agropecuaria: false, alunos }, periodo);
    const mec = m.chMinimaMec ?? 0;
    const mecPredito = tabelaChMec.get(`${tipo}|${m.curso}|${p.cargaHorariaMinima}|${tipo.startsWith("LICEN") ? p.cargaHoraria : ""}`) ?? p.cargaHorariaMinima ?? 0;
    const pesoTabela = (chMec: number) => tabelaPeso.get(`${tipo}|${oferta}|${m.curso}|${chMec}`) ?? Number(m.pesoCursoMatriz);
    // Peso da coluna: aceita o bônus de agropecuária como o valor que mais se aproxima.
    const sem = calc(Number(m.pesoCursoMatriz), mec);
    const a = Math.abs(sem * 1.5 - mt) < Math.abs(sem - mt) ? sem * 1.5 : sem;
    const a2 = calc(pesoTabela(mec), mec);
    const b2 = calc(pesoTabela(mecPredito), mecPredito);
    for (const [k, v] of [[Object.keys(niveis)[0]!, a], [Object.keys(niveis)[1]!, a2], [Object.keys(niveis)[2]!, b2]] as const) {
      niveis[k]!.soma += v;
      if (Math.abs(v - mt) <= 1e-4 * Math.max(1, mt)) niveis[k]!.ok++;
    }
  }
  console.log({ ciclos: total, somaMdo: somaMdo.toFixed(1) });
  for (const [k, v] of Object.entries(niveis)) {
    console.log(`${k}: ${v.ok} de ${total} exatos (${((v.ok / total) * 100).toFixed(2)}%); soma ${(((v.soma / somaMdo) - 1) * 100).toFixed(3)}% contra a MDO`);
  }
  await prisma.$disconnect();
}
main();
