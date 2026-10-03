/**
 * O arquivo do IFSul de 2026 (planilha com fórmulas, 03/10) tem a aba Parâmetros com marcadores de texto onde deveriam estar as matrículas
 * totais da rede ("MT_PRESENCIAL") e o período da PNP em 2025 (para o ciclo 2026 o ano-base é 2024). Este script refaz a Matrícula Total de cada
 * ciclo com o motor do sistema, em cada hipótese de período, e compara com o total do IFSul que a própria MDO publicou no relatório resumido
 * de 2026 (Matrícula Total 38.641,93; Valor R$ 40.898.767,34). Só lê.
 *
 * Uso: npx tsx scripts/_analise_ifsul_2026.ts
 */
import ExcelJS from "exceljs";
import { matriculaTotalDoCiclo, type CicloParaCalculo } from "../src/lib/mdo/matriculaTotal";

const arq = "C:/Users/USER/OneDrive/Documentos/IFSul/_Matriz orçamentária - CONIF/mdo.iftm.edu.br/Exportados/01 - Matriz orçamentária/5a fase - Matriz de Distribuição Orçamentária/01 - Completo proposta/2026/20261003_participacao_orcamentaria_2026_IFSul.xlsx";

function valor(c: unknown): unknown {
  if (c && typeof c === "object" && "result" in (c as object)) return (c as { result: unknown }).result;
  return c;
}
function dia(c: unknown): Date | null {
  const v = valor(c);
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  return null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arq);
  const ws = wb.getWorksheet("CICLOS")!;
  const ciclos: { c: CicloParaCalculo; repasse: string; mtPlanilha: number; campus: string }[] = [];
  ws.eachRow((linha, n) => {
    if (n < 5) return;
    const v = (linha.values as unknown[]).slice(1);
    const inicio = dia(v[15]), termino = dia(v[16]), jub = dia(v[17]);
    if (!inicio || !termino || !jub) return;
    ciclos.push({
      repasse: String(valor(v[24]) ?? ""),
      campus: String(valor(v[3]) ?? ""),
      mtPlanilha: Number(valor(v[23]) ?? 0),
      c: {
        inicio, termino, jubilamento: jub,
        chCiclo: Number(valor(v[19]) ?? 0), chMec: Number(valor(v[18]) ?? 0), chMatriz: Number(valor(v[20]) ?? 0),
        peso: Number(valor(v[21]) ?? 1), agropecuaria: String(valor(v[10]) ?? "").toUpperCase().startsWith("S"),
        alunos: Number(valor(v[22]) ?? 0),
      },
    });
  });
  console.log(`${ciclos.length} ciclos lidos.`);
  console.log(`Matrícula Total que a própria planilha traz (coluna X, valor em cache): ${ciclos.reduce((s, x) => s + x.mtPlanilha, 0).toFixed(4)}`);
  for (const [rotulo, inicio, fim] of [["2024", Date.UTC(2024, 0, 1), Date.UTC(2024, 11, 31)], ["2025", Date.UTC(2025, 0, 1), Date.UTC(2025, 11, 31)]] as const) {
    const periodo = { inicio: new Date(inicio), fim: new Date(fim) };
    const porRepasse = new Map<string, number>();
    let total = 0;
    for (const x of ciclos) {
      const mt = matriculaTotalDoCiclo(x.c, periodo);
      total += mt;
      porRepasse.set(x.repasse, (porRepasse.get(x.repasse) ?? 0) + mt);
    }
    console.log(`Motor com período ${rotulo}: MT ${total.toFixed(4)} | ${[...porRepasse].sort().map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" | ")}`);
  }
  console.log("MDO (resumo 2026, IFSul): MT 38641.9323 | EAD FP 5305.34 | EAD MOOC 3299.23 | EAD 4542.74 | PRESENCIAL 25494.63");
}

main();
