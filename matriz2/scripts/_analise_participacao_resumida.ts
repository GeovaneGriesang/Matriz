/**
 * Lê os relatórios "Participação" resumidos por curso (17 colunas, sem código de ciclo) de um ciclo e mostra, por forma de repasse, quanto vale
 * uma unidade de Matrícula Total (valor ÷ MT). A razão entre elas é o peso de cada modalidade que a MDO de fato aplicou (EAD 0,25; MOOC 0,08 ou 0,8; FP 0,8).
 * Também soma a Matrícula Total por repasse, que são as "matrículas totais da rede" dos parâmetros dos arquivos por ciclo.
 *
 * Uso: npx tsx scripts/_analise_participacao_resumida.ts <arquivo.xlsx> [sigla-parte-do-nome-da-instituicao]
 */
import ExcelJS from "exceljs";

const r = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const arquivo = process.argv[2];
  const filtro = process.argv[3]?.toUpperCase();
  if (!arquivo) throw new Error("Informe o arquivo.");
  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(arquivo, { entries: "emit", worksheets: "emit", sharedStrings: "cache", styles: "ignore" });
  const porRepasse = new Map<string, { valor: number; mt: number }>();
  const porRepasseFiltro = new Map<string, { valor: number; mt: number }>();
  let primeira = true;
  let linhas = 0;
  for await (const planilha of leitor) {
    for await (const linha of planilha) {
      if (primeira) { primeira = false; continue; }
      const v = (linha.values as unknown[]).slice(1);
      const repasse = String(v[10] ?? "");
      const mt = Number(v[13] ?? 0);
      const valor = Number(v[14] ?? 0);
      linhas++;
      const a = porRepasse.get(repasse) ?? { valor: 0, mt: 0 };
      a.valor += valor; a.mt += mt;
      porRepasse.set(repasse, a);
      if (filtro && String(v[0] ?? "").toUpperCase().includes(filtro)) {
        const b = porRepasseFiltro.get(repasse) ?? { valor: 0, mt: 0 };
        b.valor += valor; b.mt += mt;
        porRepasseFiltro.set(repasse, b);
      }
    }
    break; // só a primeira aba (a detalhada)
  }
  console.log(`${linhas} linhas. Rede, por repasse:`);
  const presencial = porRepasse.get("PRESENCIAL");
  const base = presencial && presencial.mt > 0 ? presencial.valor / presencial.mt : 0;
  for (const [rep, x] of [...porRepasse.entries()].sort()) {
    const taxa = x.mt > 0 ? x.valor / x.mt : 0;
    console.log(`  ${rep.padEnd(10)} MT ${x.mt.toFixed(4).padStart(14)}  valor ${r(x.valor).padStart(20)}  valor por MT ${taxa.toFixed(4).padStart(10)}  razão com o presencial ${base ? (taxa / base).toFixed(4) : "-"}`);
  }
  const mtTotal = [...porRepasse.values()].reduce((s, x) => s + x.mt, 0);
  const valorTotal = [...porRepasse.values()].reduce((s, x) => s + x.valor, 0);
  console.log(`  TOTAL      MT ${mtTotal.toFixed(4).padStart(14)}  valor ${r(valorTotal).padStart(20)}`);
  if (filtro) {
    console.log(`\n${filtro}:`);
    for (const [rep, x] of [...porRepasseFiltro.entries()].sort()) console.log(`  ${rep.padEnd(10)} MT ${x.mt.toFixed(4).padStart(14)}  valor ${r(x.valor).padStart(20)}`);
    console.log(`  TOTAL      MT ${[...porRepasseFiltro.values()].reduce((s, x) => s + x.mt, 0).toFixed(4)}  valor ${r([...porRepasseFiltro.values()].reduce((s, x) => s + x.valor, 0))}`);
  }
}

main();
