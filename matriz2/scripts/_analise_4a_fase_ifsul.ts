/**
 * A planilha da 4ª fase do MDO (Checagem de Matrículas Totais, aba "Ciclos de Matrículas", exportada em 05/10/2026) traz só as entradas de cada ciclo;
 * os campos de cálculo (MT, MECHDA, jubilamento, CH da matriz) vêm vazios. Este script refaz a Matrícula Total com o motor do sistema e compara,
 * ciclo a ciclo, com a que já está no banco (6ª fase do IFSul de 2027) e com o peso do curso que a própria planilha traz. Só lê.
 *
 * Uso: npx tsx scripts/_analise_4a_fase_ifsul.ts
 */
import ExcelJS from "exceljs";
import { prisma } from "../src/server/db/prisma";
import { matriculaTotalDoCiclo, type CicloParaCalculo } from "../src/lib/mdo/matriculaTotal";
import { alunosContadosPelaMdo, chMatrizPorRegra, dataDeJubilamento } from "../src/lib/mdo/regrasCiclo";

const arq =
  "C:/Users/USER/OneDrive/Documentos/IFSul/_Matriz orçamentária - CONIF/mdo.iftm.edu.br/Manual/20261005_checagem_matriculas_totais_2025_IFSul_por_ciclos.xlsx";

const valor = (c: unknown): unknown => (c && typeof c === "object" && "result" in (c as object) ? (c as { result: unknown }).result : c);
const texto = (c: unknown) => String(valor(c) ?? "").trim();
const numero = (c: unknown) => {
  const v = valor(c);
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
function dia(c: unknown): Date | null {
  const v = valor(c);
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v ?? "").trim());
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arq);
  const ws = wb.getWorksheet("Ciclos de Matrículas");
  if (!ws) throw new Error("aba nao achada: " + wb.worksheets.map((w) => w.name).join(", "));
  const periodo = { inicio: new Date(Date.UTC(2025, 0, 1)), fim: new Date(Date.UTC(2025, 11, 31)) };

  const banco = await prisma.distribuicaoCiclo.findMany({
    where: { ano: 2027, unidade: { instituicao: { sigla: "IFSUL" } } },
    select: { codigoCiclo: true, matriculaTotal: true, pesoCursoMatriz: true, chMinimaMec: true, qtdAlunosMatriz: true, curso: true, tipoCurso: true, repasse: true },
  });
  const porCodigo = new Map(banco.map((b) => [b.codigoCiclo, b]));

  let linhas = 0, semBanco = 0, mtIguais = 0, pesoIgual = 0, chMecIgual = 0, alunosIgual = 0, repasseIgual = 0;
  let somaArq = 0, somaBanco = 0;
  const exemplos: string[] = [];
  const pesoDif = new Map<string, number>();

  ws.eachRow((linha, n) => {
    if (n < 4) return;
    const v = (linha.values as unknown[]).slice(1);
    const codigo = texto(v[11]);
    if (!codigo) return;
    linhas++;
    const tipoCurso = texto(v[6]);
    const tipoOferta = texto(v[10]);
    const inicio = dia(v[13]);
    const termino = dia(v[14]);
    if (!inicio || !termino) return;
    const chCiclo = numero(v[16]);
    const chMec = numero(v[17]);
    const peso = numero(v[19]);
    const jub = dataDeJubilamento(termino, tipoCurso);
    const alunos = alunosContadosPelaMdo(numero(v[29]), jub, periodo.inicio);
    const ciclo: CicloParaCalculo = {
      inicio, termino, jubilamento: jub, chCiclo, chMec,
      chMatriz: chMatrizPorRegra(tipoCurso, tipoOferta, chCiclo, chMec),
      peso, agropecuaria: texto(v[9]).toUpperCase().startsWith("S"), alunos,
    };
    const mt = matriculaTotalDoCiclo(ciclo, periodo);
    somaArq += mt;
    const b = porCodigo.get(codigo);
    if (!b) { semBanco++; return; }
    const mtBanco = Number(b.matriculaTotal);
    somaBanco += mtBanco;
    if (Math.abs(mt - mtBanco) < 1e-3) mtIguais++;
    else if (exemplos.length < 8) exemplos.push(`${codigo} ${tipoCurso.slice(0, 22)} CHmin ${chMec} peso ${peso} (banco ${Number(b.pesoCursoMatriz)}) alunos ${alunos} (banco ${Number(b.qtdAlunosMatriz)}): motor ${mt.toFixed(4)} x banco ${mtBanco.toFixed(4)}`);
    if (Math.abs(peso - Number(b.pesoCursoMatriz)) < 1e-6) pesoIgual++;
    else { const k = `${peso} (4ª fase) x ${Number(b.pesoCursoMatriz)} (6ª fase IFSul)`; pesoDif.set(k, (pesoDif.get(k) ?? 0) + 1); }
    if (chMec === b.chMinimaMec) chMecIgual++;
    if (alunos === Number(b.qtdAlunosMatriz)) alunosIgual++;
    if (texto(v[41]).replace(/\s+/g, "_").toUpperCase() === b.repasse) repasseIgual++;
  });

  console.log(`linhas de ciclo na 4ª fase: ${linhas}; sem par no banco: ${semBanco}`);
  console.log(`MT do motor (entradas da 4ª fase) igual à do banco: ${mtIguais} de ${linhas - semBanco}`);
  console.log(`soma MT motor ${somaArq.toFixed(4)} | soma MT banco ${somaBanco.toFixed(4)}`);
  console.log(`peso da 4ª fase igual ao do banco: ${pesoIgual}; CH mínima igual: ${chMecIgual}; alunos iguais: ${alunosIgual}; repasse igual: ${repasseIgual}`);
  console.log("diferenças de peso:", [...pesoDif].sort((a, b) => b[1] - a[1]).slice(0, 10));
  for (const e of exemplos) console.log("  diverge:", e);
  await prisma.$disconnect();
}
main();
