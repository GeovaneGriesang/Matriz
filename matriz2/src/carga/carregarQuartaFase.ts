import path from "node:path";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { colunasDaQuartaFase, COLUNAS_QUARTA_FASE, valorDaColuna, type ChaveColuna } from "@/lib/mdo/quartaFase";
import { checksumArquivo, data, dataDeGeracao, numero, texto } from "./planilha";

/**
 * Carrega uma planilha da 4ª fase da MDO (Checagem de Matrículas Totais, versão 8.5): a aba "Ciclos de Matrículas", linha a
 * linha, e o resumo por unidade da aba "Instituíção" (assim mesmo, com o acento a mais, no arquivo).
 *
 * Dois tipos de arquivo têm esse formato. A exportação da MDO chega só com as fórmulas (o Excel ainda não as calculou, então
 * as colunas de resultado vêm vazias). A planilha que a DDI abriu e salvou no Excel traz os resultados gravados, e são eles
 * que a tela /conferencia/quarta-fase compara, coluna a coluna, com a conta do sistema.
 */

/** Colunas da aba "Ciclos de Matrículas" (1 = A). Cabeçalho na linha 3, dados da 4 em diante. Conferidas em 2026-10-29. */
const COL = {
  uf: 1,
  cidade: 2,
  instituicao: 3,
  unidade: 4,
  modalidade: 5,
  financiamento: 6,
  tipoCurso: 7,
  curso: 8,
  areaEixo: 9,
  agropecuaria: 10,
  tipoOferta: 11,
  codigoCiclo: 12,
  nomeCiclo: 13,
  inicio: 14,
  termino: 15,
  chCiclo: 17,
  chMec: 18,
  peso: 20,
  inicioPeriodo: 28,
  fimPeriodo: 29,
  matriculas: 30,
  situacao: 42,
} as const;

/** Letra da coluna (como em `COLUNAS_QUARTA_FASE`) para o número dela. */
function numeroDaColuna(letra: string): number {
  return [...letra].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
}

const PRIMEIRA_LINHA = 4;
const LOTE = 500;

/** O resultado gravado de uma célula de fórmula; `undefined` quando o arquivo não gravou nenhum. */
function resultadoGravado(bruto: unknown): number | undefined {
  if (bruto && typeof bruto === "object" && !(bruto instanceof Date)) {
    const o = bruto as Record<string, unknown>;
    if ("formula" in o || "sharedFormula" in o) return typeof o.result === "number" ? o.result : undefined;
  }
  return numero(bruto) ?? undefined;
}

export interface ResultadoQuartaFase {
  arquivo: string;
  ciclo: number;
  ciclos: number;
  unidades: number;
  /** Linhas em que o Excel gravou a Matrícula Total (coluna AO). */
  comResultado: number;
  /** Das linhas com resultado, quantas têm TODAS as colunas iguais às fórmulas refeitas pelo sistema. */
  iguais: number;
  ignoradas: number;
  avisos: string[];
}

export async function carregarQuartaFase(caminho: string, ciclo: number): Promise<ResultadoQuartaFase> {
  const arquivo = path.basename(caminho);
  const avisos: string[] = [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.getWorksheet("Ciclos de Matrículas");
  if (!ws) throw new Error(`${arquivo}: não achei a aba "Ciclos de Matrículas".`);
  const resumo = wb.worksheets.find((w) => w.name.toLowerCase().startsWith("institu"));

  const versao = texto(ws.getRow(2).getCell(1).value);
  if (versao !== "versão 8.5") avisos.push(`${arquivo}: versão "${versao ?? "?"}" (o layout foi conferido na 8.5).`);

  const sigla = texto(ws.getRow(PRIMEIRA_LINHA).getCell(COL.instituicao).value);
  const instituicao = sigla ? await prisma.instituicao.findUnique({ where: { sigla } }) : null;

  // Recarregar o mesmo arquivo substitui a carga anterior dele (as linhas caem junto, em cascata).
  await prisma.fonteDados.deleteMany({ where: { fase: "F4_CHECAGEM_MATRICULAS", cicloOrcamento: ciclo, arquivo } });
  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F4_CHECAGEM_MATRICULAS",
      cicloOrcamento: ciclo,
      arquivo,
      geradoEm: dataDeGeracao(resumo ? texto(resumo.getRow(4).getCell(1).value) : null),
      abrangencia: "INSTITUICAO",
      instituicaoId: instituicao?.id ?? null,
      checksum: checksumArquivo(caminho),
      ressalva: `Planilha da 4ª fase da MDO (${versao ?? "versão não identificada"}), aba "Ciclos de Matrículas".`,
    },
  });

  const linhas: Prisma.QuartaFaseCicloCreateManyInput[] = [];
  let comResultado = 0;
  let iguais = 0;
  let ignoradas = 0;

  ws.eachRow((row, n) => {
    if (n < PRIMEIRA_LINHA) return;
    const v = (c: number) => row.getCell(c).value;
    const codigoCiclo = texto(v(COL.codigoCiclo));
    const unidade = texto(v(COL.unidade));
    const inicio = data(v(COL.inicio));
    const termino = data(v(COL.termino));
    const inicioPeriodo = data(v(COL.inicioPeriodo));
    const fimPeriodo = data(v(COL.fimPeriodo));
    if (!codigoCiclo || !unidade || !inicio || !termino || !inicioPeriodo || !fimPeriodo) {
      if (codigoCiclo || unidade) ignoradas++;
      return;
    }

    const entrada = {
      tipoCurso: texto(v(COL.tipoCurso)) ?? "",
      tipoOferta: texto(v(COL.tipoOferta)) ?? "",
      agropecuaria: (texto(v(COL.agropecuaria)) ?? "").toUpperCase() === "SIM",
      inicio,
      termino,
      chCiclo: numero(v(COL.chCiclo)) ?? 0,
      chMec: numero(v(COL.chMec)) ?? 0,
      peso: numero(v(COL.peso)) ?? 0,
      inicioPeriodo,
      fimPeriodo,
      matriculas: numero(v(COL.matriculas)) ?? 0,
    };

    // O Excel deixa em branco o resultado que deu zero; com a Matrícula Total gravada, branco nas outras colunas é zero.
    const mtGravada = resultadoGravado(v(numeroDaColuna("AO")));
    let resultados: Record<ChaveColuna, number> | null = null;
    if (mtGravada !== undefined || row.getCell(numeroDaColuna("AM")).value !== null) {
      const temAlgum = COLUNAS_QUARTA_FASE.some((c) => resultadoGravado(v(numeroDaColuna(c.letra))) !== undefined);
      if (temAlgum) {
        resultados = {} as Record<ChaveColuna, number>;
        for (const c of COLUNAS_QUARTA_FASE) resultados[c.chave] = resultadoGravado(v(numeroDaColuna(c.letra))) ?? 0;
      }
    }
    if (resultados) {
      comResultado++;
      const refeitas = colunasDaQuartaFase(entrada);
      if (COLUNAS_QUARTA_FASE.every((c) => Math.abs(valorDaColuna(refeitas, c.chave) - resultados![c.chave]) < 1e-6)) iguais++;
    }

    linhas.push({
      fonteDadosId: fonte.id,
      cicloOrcamento: ciclo,
      linha: n,
      uf: texto(v(COL.uf)),
      cidade: texto(v(COL.cidade)),
      instituicao: texto(v(COL.instituicao)) ?? "",
      unidade,
      modalidade: texto(v(COL.modalidade)) ?? "",
      financiamento: texto(v(COL.financiamento)) ?? "",
      tipoCurso: entrada.tipoCurso,
      curso: texto(v(COL.curso)) ?? "",
      areaEixo: texto(v(COL.areaEixo)),
      agropecuaria: entrada.agropecuaria,
      tipoOferta: entrada.tipoOferta,
      codigoCiclo,
      nomeCiclo: texto(v(COL.nomeCiclo)),
      inicio,
      termino,
      chCiclo: Math.round(entrada.chCiclo),
      chMec: Math.round(entrada.chMec),
      peso: entrada.peso,
      inicioPeriodo,
      fimPeriodo,
      matriculas: entrada.matriculas,
      situacao: texto(v(COL.situacao)) ?? "",
      resultadosPlanilha: resultados ?? undefined,
    });
  });

  for (let i = 0; i < linhas.length; i += LOTE) await prisma.quartaFaseCiclo.createMany({ data: linhas.slice(i, i + LOTE) });

  // Aba "Instituíção": uma linha por unidade, da 7 em diante (a 6 é a de totais).
  const unidades: Prisma.QuartaFaseUnidadeCreateManyInput[] = [];
  if (resumo) {
    resumo.eachRow((row, n) => {
      if (n < 7) return;
      const unidade = texto(row.getCell(4).value);
      if (!unidade) return;
      const r = (c: number) => resultadoGravado(row.getCell(c).value) ?? null;
      unidades.push({
        fonteDadosId: fonte.id,
        cicloOrcamento: ciclo,
        linha: n,
        unidade,
        alunosPresencial: r(5),
        alunosPresencialFe: r(6),
        alunosEad: r(7),
        alunosEadMooc: r(8),
        alunosEadFp: r(9),
        alunosTotal: r(10),
        mtPresencial: r(14),
        mtEad: r(15),
        mtEadMooc: r(16),
        mtEadFp: r(17),
      });
    });
    if (unidades.length) await prisma.quartaFaseUnidade.createMany({ data: unidades });
  }

  return { arquivo, ciclo, ciclos: linhas.length, unidades: unidades.length, comResultado, iguais, ignoradas, avisos };
}
