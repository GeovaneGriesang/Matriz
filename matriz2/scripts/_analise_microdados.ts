/**
 * Análise exploratória (não faz parte da carga): agrega as matrículas de 2025 por ciclo e confronta com a
 * 6ª fase da MDO (DistribuicaoCiclo 2027) e, no IFSul, com a conferência por ciclo (ConferenciaCiclo 2027).
 * Uso: npx tsx scripts/_analise_microdados.ts [ano] [sigla-instituicao-pnp|TODAS]
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { prisma } from "../src/server/db/prisma";
import { AgregadorMatriculas, type CicloMicrodado } from "../src/lib/pnp/microdados";

const base =
  "C:/Users/USER/OneDrive/Documentos/IFSul/_Matriz orçamentária - CONIF/CSV da PNP/Manual/2027/Produtos de dados/Microdados";

async function agregar(ano: number, filtro: string): Promise<AgregadorMatriculas> {
  const ag = new AgregadorMatriculas();
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(base, `microdados_matriculas_${ano}.csv.gz`)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  let cab = true;
  let colInst = -1;
  for await (const l of rl) {
    if (cab) {
      ag.adicionar(l);
      colInst = l.replace(/^\uFEFF/, "").split(";").indexOf("Instituição");
      cab = false;
      continue;
    }
    if (filtro !== "TODAS" && l.split(";")[colInst] !== filtro) continue;
    ag.adicionar(l);
  }
  return ag;
}

async function main() {
  const ano = Number(process.argv[2] ?? 2025);
  const filtro = process.argv[3] ?? "IFSUL";
  const t0 = Date.now();
  const ag = await agregar(ano, filtro);
  console.log(`linhas ${ag.linhas}, ciclos ${ag.ciclos.size}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  const lista = [...ag.ciclos.values()];
  const soma = (f: (c: CicloMicrodado) => number) => lista.reduce((s, c) => s + f(c), 0);
  console.log("matrículas", soma((c) => c.matriculas), "atendidas", soma((c) => c.atendidas));
  const porSit = new Map<string, number>();
  for (const c of lista) for (const [k, v] of Object.entries(c.porSituacao)) porSit.set(k, (porSit.get(k) ?? 0) + v);
  console.log([...porSit].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join("\n"));

  // Confronto com a 6ª fase (ciclos de 2027 = PNP 2025).
  const mdo = await prisma.distribuicaoCiclo.findMany({
    where: { ano: ano + 2, ...(filtro === "IFSUL" ? { unidade: { instituicao: { sigla: "IFSUL" } } } : {}) },
    select: { codigoCiclo: true, qtdAlunosMatriz: true, chMinimaMec: true, cargaHoraria: true, chMatriz: true, pesoCursoMatriz: true, inicio: true, termino: true, jubilamento: true, tipoCurso: true, tipoOferta: true, curso: true },
  });
  const mdoPorCiclo = new Map(mdo.map((m) => [m.codigoCiclo, m]));
  const pnpPorCiclo = new Map<string, CicloMicrodado>();
  for (const c of lista) pnpPorCiclo.set(c.ciclo, c);
  let nosDois = 0, soMdo = 0, soPnp = 0, chIgual = 0, chMinIgual = 0, iniIgual = 0, fimIgual = 0, alunosIgual = 0, alunosAtIgual = 0;
  const exemplos: string[] = [];
  for (const [cod, m] of mdoPorCiclo) {
    const p = pnpPorCiclo.get(cod);
    if (!p) { soMdo++; continue; }
    nosDois++;
    if (p.cargaHoraria === m.cargaHoraria) chIgual++;
    if (p.cargaHorariaMinima === m.chMinimaMec) chMinIgual++;
    if (p.inicio === (m.inicio ? m.inicio.toISOString().slice(0, 10) : null)) iniIgual++;
    if (p.fimPrevisto === (m.termino ? m.termino.toISOString().slice(0, 10) : null)) fimIgual++;
    const q = Number(m.qtdAlunosMatriz ?? 0);
    if (q === p.matriculas) alunosIgual++;
    if (q === p.atendidas) alunosAtIgual++;
    if (exemplos.length < 8 && q !== p.atendidas) exemplos.push(`${cod} ${m.curso.slice(0, 28)} mdo=${q} pnp.mat=${p.matriculas} pnp.atend=${p.atendidas} ${JSON.stringify(p.porSituacao)}`);
  }
  for (const cod of pnpPorCiclo.keys()) if (!mdoPorCiclo.has(cod)) soPnp++;
  console.log({ ciclosMdo: mdoPorCiclo.size, ciclosPnp: pnpPorCiclo.size, nosDois, soMdo, soPnp, chIgual, chMinIgual, iniIgual, fimIgual, alunosIgual_matriculas: alunosIgual, alunosIgual_atendidas: alunosAtIgual });
  console.log(exemplos.join("\n"));
  await regraDeQtd(ano, mdo, pnpPorCiclo);
  await prisma.$disconnect();
}
main();

async function regraDeQtd(
  ano: number,
  mdo: { codigoCiclo: string; qtdAlunosMatriz: unknown; jubilamento: Date | null; termino: Date | null; tipoCurso: string | null; tipoOferta: string | null }[],
  pnp: Map<string, CicloMicrodado>,
) {
  const inicioPeriodo = new Date(Date.UTC(ano, 0, 1)).getTime();
  let zeroComPnp = 0, zeroJubilado = 0, positivoJubilado = 0, positivoIgualMat = 0, positivo = 0, zeroNaoJubilado = 0;
  const prazo = new Map<string, Map<number, number>>();
  for (const m of mdo) {
    const p = pnp.get(m.codigoCiclo);
    if (!p || !m.jubilamento || !m.termino) continue;
    const q = Number(m.qtdAlunosMatriz ?? 0);
    const jub = m.jubilamento.getTime() < inicioPeriodo;
    if (q === 0 && p.matriculas > 0) { zeroComPnp++; if (jub) zeroJubilado++; else zeroNaoJubilado++; }
    if (q > 0) { positivo++; if (jub) positivoJubilado++; if (q === p.matriculas) positivoIgualMat++; }
    const dias = Math.round((m.jubilamento.getTime() - m.termino.getTime()) / 86400000);
    const k = `${m.tipoCurso}|${m.tipoOferta}`;
    const mapa = prazo.get(k) ?? new Map<number, number>();
    mapa.set(dias, (mapa.get(dias) ?? 0) + 1);
    prazo.set(k, mapa);
  }
  console.log("regra da quantidade de alunos:", { zeroComPnp, zeroJubilado, zeroNaoJubilado, positivo, positivoJubilado, positivoIgualMat });
  console.log("prazo de jubilamento (dias depois do termino) por tipo de curso e oferta:");
  for (const [k, mapa] of [...prazo].sort()) console.log("  ", k, [...mapa].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d, n]) => `${d}d x${n}`).join(", "));
}
