import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { RAIZ_DADOS } from "./caminhos";

/**
 * Carrega a despesa e a receita do projeto de lei orçamentária (PLOA) do Estado do RS a partir das planilhas que a Secretaria de
 * Planejamento publica em planejamento.rs.gov.br/orcamento-estado ("ploa-AAAA-despesas.xlsx" e "ploa-AAAA-receitas.xlsx"). Os
 * arquivos ficam em "Orçamento do Estado do RS/<ano>/". Pode ser repetido: apaga e regrava o exercício.
 */
export const PASTA_ORCAMENTO_RS = path.join(RAIZ_DADOS, "Orçamento do Estado do RS");

function acharArquivo(exercicio: number, final: string): string | null {
  const pasta = path.join(PASTA_ORCAMENTO_RS, String(exercicio));
  if (!fs.existsSync(pasta)) return null;
  const achado = fs
    .readdirSync(pasta)
    .filter((n) => n.toLowerCase().endsWith(final))
    .sort()
    .pop();
  return achado ? path.join(pasta, achado) : null;
}

const valorDaCelula = (v: ExcelJS.CellValue): unknown => {
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  return v;
};
const texto = (v: ExcelJS.CellValue) => String(valorDaCelula(v) ?? "").trim();
const numero = (v: ExcelJS.CellValue) => Number(valorDaCelula(v) ?? 0);

export interface ResultadoOrcamentoRs {
  exercicio: number;
  linhasDespesa: number;
  linhasReceita: number;
  despesa: number;
  receita: number;
}

export async function carregarOrcamentoRs(exercicio: number): Promise<ResultadoOrcamentoRs> {
  const arqDespesa = acharArquivo(exercicio, `ploa-${exercicio}-despesas.xlsx`);
  const arqReceita = acharArquivo(exercicio, `ploa-${exercicio}-receitas.xlsx`);
  if (!arqDespesa) throw new Error(`Planilha ploa-${exercicio}-despesas.xlsx não encontrada em ${path.join(PASTA_ORCAMENTO_RS, String(exercicio))}.`);

  const fonteDespesa = `Governo do RS, Secretaria de Planejamento, PLOA ${exercicio}, ${path.basename(arqDespesa)}`;
  const despesa: Prisma.OrcamentoEstadualDespesaCreateManyInput[] = [];
  let wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arqDespesa);
  let ws = wb.worksheets[0]!;
  const cab = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) => texto(v));
  const col = (nome: string) => {
    const i = cab.findIndex((c) => c === nome);
    if (i < 0) throw new Error(`Coluna "${nome}" não encontrada em ${path.basename(arqDespesa)}.`);
    return i;
  };
  const c = {
    orgaoCodigo: col("Órgão Código"),
    orgaoNome: col("Órgão Nome"),
    uoCodigo: col("Uo Código"),
    uoNome: col("Uo Nome"),
    funcaoCodigo: col("Função Código"),
    funcaoNome: col("Função Nome"),
    subfuncaoCodigo: col("Subfunção Código"),
    subfuncaoNome: col("Subfunção Nome"),
    acaoCodigo: col("Instrumento de Programação Código"),
    acaoNome: col("Instrumento de Programação Nome"),
    grupoCodigo: col("Grupo Despesa Código"),
    grupoNome: col("Grupo Despesa Nome"),
    fonteCodigo: col("Fonte Recurso Código"),
    fonteNome: col("Fonte Recurso Nome"),
    valor: col("Valor"),
  };
  ws.eachRow((r, n) => {
    if (n === 1) return;
    const v = r.values as ExcelJS.CellValue[];
    const valor = numero(v[c.valor]);
    if (!Number.isFinite(valor) || texto(v[c.orgaoNome]) === "") return;
    despesa.push({
      exercicio,
      documento: "PLOA",
      orgaoCodigo: numero(v[c.orgaoCodigo]),
      orgaoNome: texto(v[c.orgaoNome]).slice(0, 200),
      uoCodigo: numero(v[c.uoCodigo]),
      uoNome: texto(v[c.uoNome]).slice(0, 200),
      funcaoCodigo: numero(v[c.funcaoCodigo]),
      funcaoNome: texto(v[c.funcaoNome]).slice(0, 100),
      subfuncaoCodigo: numero(v[c.subfuncaoCodigo]),
      subfuncaoNome: texto(v[c.subfuncaoNome]).slice(0, 150),
      acaoCodigo: numero(v[c.acaoCodigo]),
      acaoNome: texto(v[c.acaoNome]).slice(0, 300),
      grupoCodigo: numero(v[c.grupoCodigo]),
      grupoNome: texto(v[c.grupoNome]).slice(0, 100),
      fonteCodigo: numero(v[c.fonteCodigo]),
      fonteNome: texto(v[c.fonteNome]).slice(0, 200),
      valor,
      fonte: fonteDespesa,
    });
  });

  const receita: Prisma.OrcamentoEstadualReceitaCreateManyInput[] = [];
  if (arqReceita) {
    const fonteReceita = `Governo do RS, Secretaria de Planejamento, PLOA ${exercicio}, ${path.basename(arqReceita)}`;
    wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(arqReceita);
    ws = wb.worksheets[0]!;
    ws.eachRow((r, n) => {
      if (n === 1) return;
      const v = r.values as ExcelJS.CellValue[];
      const valor = numero(v[5]);
      if (!Number.isFinite(valor) || texto(v[3]) === "") return;
      receita.push({
        exercicio,
        documento: "PLOA",
        orgaoCodigo: numero(v[1]),
        orgaoNome: texto(v[2]).slice(0, 200),
        codigo: texto(v[3]).slice(0, 30),
        nome: texto(v[4]).slice(0, 300),
        valor,
        fonte: fonteReceita,
      });
    });
  }

  await prisma.$transaction([
    prisma.orcamentoEstadualDespesa.deleteMany({ where: { exercicio, documento: "PLOA" } }),
    prisma.orcamentoEstadualReceita.deleteMany({ where: { exercicio, documento: "PLOA" } }),
    prisma.orcamentoEstadualDespesa.createMany({ data: despesa }),
    prisma.orcamentoEstadualReceita.createMany({ data: receita }),
  ]);
  return {
    exercicio,
    linhasDespesa: despesa.length,
    linhasReceita: receita.length,
    despesa: despesa.reduce((s, d) => s + Number(d.valor), 0),
    receita: receita.reduce((s, d) => s + Number(d.valor), 0),
  };
}
