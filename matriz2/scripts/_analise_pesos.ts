/**
 * Análise exploratória: o que, da Matrícula Total, dá para derivar dos microdados da PNP e o que ainda
 * depende de tabela da MDO (peso do curso, CH mínima do MEC, CH da matriz, agropecuária).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { prisma } from "../src/server/db/prisma";
import { AgregadorMatriculas, type CicloMicrodado } from "../src/lib/pnp/microdados";

const base =
  "C:/Users/USER/OneDrive/Documentos/IFSul/_Matriz orçamentária - CONIF/CSV da PNP/Manual/2027/Produtos de dados/Microdados";

async function agregar(ano: number): Promise<Map<string, CicloMicrodado>> {
  const ag = new AgregadorMatriculas();
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(base, `microdados_matriculas_${ano}.csv.gz`)).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const l of rl) ag.adicionar(l);
  const porCiclo = new Map<string, CicloMicrodado>();
  for (const c of ag.ciclos.values()) porCiclo.set(c.ciclo, c);
  return porCiclo;
}

function dependencia<T>(rotulo: string, itens: T[], chave: (t: T) => string, valor: (t: T) => string) {
  const m = new Map<string, Map<string, number>>();
  for (const it of itens) {
    const k = chave(it);
    const v = valor(it);
    const mm = m.get(k) ?? new Map<string, number>();
    mm.set(v, (mm.get(v) ?? 0) + 1);
    m.set(k, mm);
  }
  let determinados = 0;
  let ciclosEmChaveUnica = 0;
  let total = 0;
  const ambiguos: string[] = [];
  for (const [k, mm] of m) {
    const n = [...mm.values()].reduce((s, x) => s + x, 0);
    total += n;
    if (mm.size === 1) {
      determinados++;
      ciclosEmChaveUnica += n;
    } else if (ambiguos.length < 6) ambiguos.push(`${k} => ${[...mm].map(([a, b]) => `${a} x${b}`).join(", ")}`);
  }
  console.log(`${rotulo}: ${m.size} chaves, ${determinados} determinam o valor (${ciclosEmChaveUnica} de ${total} ciclos)`);
  if (ambiguos.length) console.log("   ambíguas, ex.:\n   " + ambiguos.join("\n   "));
}

async function main() {
  const ano = 2025;
  const pnp = await agregar(ano);
  const mdo = await prisma.distribuicaoCiclo.findMany({
    where: { ano: ano + 2 },
    select: {
      codigoCiclo: true, curso: true, tipoCurso: true, tipoOferta: true, areaEixo: true, pesoCursoMatriz: true,
      chMinimaMec: true, chMatriz: true, cargaHoraria: true, qtdAlunosMatriz: true, matriculaTotal: true, nivel: true,
      jubilamento: true, termino: true, inicio: true, repasse: true,
    },
  });
  type Par = (typeof mdo)[number] & { p: CicloMicrodado };
  const pares: Par[] = [];
  for (const m of mdo) {
    const p = pnp.get(m.codigoCiclo);
    if (p) pares.push({ ...m, p });
  }
  console.log("pares", pares.length);

  // 1) O peso do curso é função do nome do curso?
  const peso = (x: Par) => String(Number(x.pesoCursoMatriz));
  dependencia("peso por (tipoCurso, curso)", pares, (x) => `${x.tipoCurso}|${x.curso}`, peso);
  dependencia("peso por (tipoCurso, curso, eixo)", pares, (x) => `${x.tipoCurso}|${x.curso}|${x.areaEixo}`, peso);
  dependencia("peso por (tipoCurso, subeixo PNP, curso)", pares, (x) => `${x.tipoCurso}|${x.p.subeixo}|${x.curso}`, peso);
  dependencia("peso por cursoEmec PNP", pares.filter((x) => x.p.cursoEmec), (x) => x.p.cursoEmec, peso);
  dependencia("peso por (tipoCurso, FEC da PNP)", pares, (x) => `${x.tipoCurso}|${x.p.fatorEsforco}`, peso);
  dependencia("FEC da PNP por (tipoCurso, curso)", pares, (x) => `${x.tipoCurso}|${x.curso}`, (x) => String(x.p.fatorEsforco));

  // 2) CH mínima do MEC e CH da matriz
  const chmec = (x: Par) => String(x.chMinimaMec);
  dependencia("CH MEC (MDO) por (tipoCurso, curso)", pares, (x) => `${x.tipoCurso}|${x.curso}`, chmec);
  dependencia("CH MEC (MDO) por (tipoCurso, tipoOferta, curso)", pares, (x) => `${x.tipoCurso}|${x.tipoOferta}|${x.curso}`, chmec);
  dependencia("CH MEC (MDO) por (tipoCurso, curso, CH mínima PNP)", pares, (x) => `${x.tipoCurso}|${x.curso}|${x.p.cargaHorariaMinima}`, chmec);
  const difMin = pares.filter((x) => x.p.cargaHorariaMinima !== x.chMinimaMec);
  const porTipo = new Map<string, { n: number; pnpMenor: number; pnpMaior: number }>();
  for (const x of difMin) {
    const k = `${x.tipoCurso}|${x.tipoOferta}`;
    const r = porTipo.get(k) ?? { n: 0, pnpMenor: 0, pnpMaior: 0 };
    r.n++;
    if ((x.p.cargaHorariaMinima ?? 0) < (x.chMinimaMec ?? 0)) r.pnpMenor++;
    else r.pnpMaior++;
    porTipo.set(k, r);
  }
  console.log("CH mínima PNP diferente da MDO, por tipo:", difMin.length);
  for (const [k, r] of [...porTipo].sort((a, b) => b[1].n - a[1].n).slice(0, 12)) console.log("  ", k, JSON.stringify(r));

  // 3) CH da matriz: regra do 2ª fase (FIC e doutorado = CH do ciclo; Proeja 2400; integrado 3000/3100/3200 conforme a CH MEC; senão CH MEC)
  function chMatrizPorRegra(x: Par): number | null {
    const tipo = x.tipoCurso ?? "";
    const oferta = x.tipoOferta ?? "";
    const chc = x.cargaHoraria ?? 0;
    const mec = x.chMinimaMec ?? 0;
    if (tipo.startsWith("QUALIFICACAO") || tipo === "DOUTORADO") return chc;
    if (oferta.includes("PROEJA")) return 2400;
    if (oferta === "INTEGRADO") return mec === 800 ? 3000 : mec === 1000 ? 3100 : mec === 1200 ? 3200 : mec;
    return mec;
  }
  let chmOk = 0;
  const chmErros: string[] = [];
  for (const x of pares) {
    if (chMatrizPorRegra(x) === x.chMatriz) chmOk++;
    else if (chmErros.length < 8) chmErros.push(`${x.tipoCurso}|${x.tipoOferta}|${x.curso} chc=${x.cargaHoraria} mec=${x.chMinimaMec} matriz=${x.chMatriz} regra=${chMatrizPorRegra(x)}`);
  }
  console.log(`CH da matriz pela regra (com a CH MEC da MDO): ${chmOk} de ${pares.length}`);
  console.log(chmErros.join("\n"));

  // 4) Os ciclos que só existem na PNP
  const noMdo = new Set(mdo.map((m) => m.codigoCiclo));
  const soPnp = [...pnp.values()].filter((p) => !noMdo.has(p.ciclo));
  const inicioPeriodo = Date.UTC(ano, 0, 1);
  const tiposSoPnp = new Map<string, number>();
  let jubilados = 0;
  for (const p of soPnp) {
    const fim = p.fimPrevisto ? Date.parse(p.fimPrevisto) : NaN;
    const prazo = p.tipoCurso.toUpperCase().startsWith("QUALIFICA") ? 0 : 1095 * 86400000;
    if (Number.isFinite(fim) && fim + prazo < inicioPeriodo) jubilados++;
    tiposSoPnp.set(p.tipoCurso, (tiposSoPnp.get(p.tipoCurso) ?? 0) + 1);
  }
  console.log(`ciclos só na PNP: ${soPnp.length}, jubilados pela regra: ${jubilados}`);
  console.log([...tiposSoPnp].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(" | "));
  await prisma.$disconnect();
}
main();
