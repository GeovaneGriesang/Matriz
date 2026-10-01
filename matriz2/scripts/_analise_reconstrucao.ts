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
  // Tabelas aprendidas da própria MDO (serviriam de "tabela" para os demais anos).
  const pesoPorChave = new Map<string, number>();
  const chMecPorChave = new Map<string, number>();
  {
    const grupos = new Map<string, number[]>();
    const grupos2 = new Map<string, number[]>();
    for (const m of mdo) {
      const k = `${m.tipoCurso}|${m.tipoOferta}|${m.curso}`;
      grupos.set(k, [...(grupos.get(k) ?? []), Number(m.pesoCursoMatriz)]);
      const k2 = `${m.tipoCurso}|${m.curso}`;
      grupos2.set(k2, [...(grupos2.get(k2) ?? []), Number(m.chMinimaMec)]);
    }
    for (const [k, v] of grupos) pesoPorChave.set(k, moda(v)!);
    for (const [k, v] of grupos2) chMecPorChave.set(k, moda(v)!);
  }

  const niveis = { A: { ok: 0, soma: 0 }, B: { ok: 0, soma: 0 }, C: { ok: 0, soma: 0 } } as Record<string, { ok: number; soma: number }>;
  let total = 0;
  let somaMdo = 0;
  const piores: string[] = [];
  for (const m of mdo) {
    const p = pnp.get(m.codigoCiclo);
    if (!p || !p.inicio || !p.fimPrevisto) continue;
    total++;
    const mt = Number(m.matriculaTotal);
    somaMdo += mt;
    const tipo = m.tipoCurso ?? "";
    const oferta = m.tipoOferta ?? "";
    const termino = new Date(p.fimPrevisto + "T00:00:00Z");
    const prazo = tipo.startsWith("QUALIFICACAO") ? 0 : 1095;
    const jub = new Date(termino.getTime() + prazo * DIA);
    // A quantidade de alunos que a MDO conta: as matrículas do ciclo, se ele não está jubilado.
    const alunos = jub.getTime() < periodo.inicio.getTime() ? 0 : p.matriculas;
    const chc = p.cargaHoraria ?? 0;

    function calcula(peso: number, chMec: number, agro: boolean): number {
      const chm = chMatrizPorRegra(tipo, oferta, chc, chMec);
      const c: CicloParaCalculo = {
        inicio: new Date(p!.inicio + "T00:00:00Z"), termino, jubilamento: jub,
        chCiclo: chc, chMec, chMatriz: chm, peso, agropecuaria: agro, alunos,
      };
      return matriculaTotalDoCiclo(c, periodo);
    }
    // A MDO traz agropecuária só no formato novo; aqui testa com e sem o bônus e fica com o que mais se aproxima.
    function melhorDeAgro(peso: number, chMec: number): number {
      const sem = calcula(peso, chMec, false);
      const com = sem * 1.5;
      return Math.abs(com - mt) < Math.abs(sem - mt) ? com : sem;
    }
    const pesoMdo = Number(m.pesoCursoMatriz);
    const a = melhorDeAgro(pesoMdo, m.chMinimaMec ?? 0);
    const pesoB = pesoPorChave.get(`${tipo}|${oferta}|${m.curso}`) ?? 1;
    const b = melhorDeAgro(pesoB, p.cargaHorariaMinima ?? 0);
    const c = melhorDeAgro(pesoB, chMecPorChave.get(`${tipo}|${m.curso}`) ?? p.cargaHorariaMinima ?? 0);
    for (const [k, v] of [["A", a], ["B", b], ["C", c]] as const) {
      niveis[k]!.soma += v;
      if (Math.abs(v - mt) <= 1e-4 * Math.max(1, mt)) niveis[k]!.ok++;
    }
    if (Math.abs(a - mt) > 1e-4 * Math.max(1, mt) && piores.length < 12) {
      piores.push(`${m.codigoCiclo} ${tipo}|${oferta}|${m.curso.slice(0, 30)} mdo=${mt.toFixed(4)} A=${a.toFixed(4)} alunosMdo=${m.qtdAlunosMatriz} alunosPnp=${alunos}`);
    }
  }
  console.log({ ciclos: total, somaMdo: somaMdo.toFixed(1) });
  for (const [k, v] of Object.entries(niveis)) {
    console.log(`nível ${k}: ${v.ok} de ${total} ciclos exatos (${((v.ok / total) * 100).toFixed(1)}%); soma ${v.soma.toFixed(1)} (${(((v.soma / somaMdo) - 1) * 100).toFixed(3)}% contra a MDO)`);
  }
  console.log(piores.join("\n"));
  await prisma.$disconnect();
}
main();
