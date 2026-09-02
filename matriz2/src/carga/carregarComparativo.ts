import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { exigirArquivo, relatorioIndicadores } from "./caminhos";
import { checksumArquivo, numero, texto } from "./planilha";

/**
 * Carrega os relatórios da pasta "03 - Indicadores" da MDO.
 *
 * Estes relatórios são **interanuais por natureza**: um único arquivo traz 2026 e
 * 2027 lado a lado. Por isso a pasta de 2026 e a de 2027 contêm arquivos byte a byte
 * idênticos, o que à primeira vista parece um erro de exportação e não é.
 *
 * Resolvem a lacuna que a 5ª fase de 2026 deixou. Aquela exportação saiu sem nenhum
 * dado de matrícula e zerou o Funcionamento; este comparativo traz os dois ciclos
 * preenchidos, e no nível de instituição bate ao centavo com a 5ª fase de 2027.
 *
 * Carregamos apenas o nível de INSTITUIÇÃO, de propósito. O arquivo irmão
 * `comparativo-institucional-completo.xlsx`, que desce a câmpus, tem valores
 * atribuídos à unidade errada: onze câmpus receberam o valor de um "irmão" cujo nome
 * é uma extensão do seu, e esse irmão desapareceu da lista. No IFSul, CAMPUS PELOTAS
 * aparece com os R$ 5.156.741,72 do CAMPUS PELOTAS VISCONDE DA GRAÇA. Enquanto isso
 * não for corrigido na origem, o nível de câmpus daquele arquivo não entra.
 */

/** Colunas de `comparativo-institucional.xlsx` (1-indexadas). */
const CMP = {
  sigla: 1,
  instituicao: 2,
  posicao: 3,
  matriculas26: 4,
  iqe26: 5,
  ae26: 6,
  total26: 7,
  matriculas27: 8,
  iqe27: 9,
  ae27: 10,
  total27: 11,
} as const;

/** Colunas de `participacao-percentual.xlsx`. */
const PAR = { ano: 1, sigla: 2, percentual: 4, ranking: 5 } as const;

/** Os dois ciclos que o comparativo cobre, na ordem das colunas. */
const CICLOS = [
  { ano: 2026, matriculas: CMP.matriculas26, iqe: CMP.iqe26, ae: CMP.ae26, total: CMP.total26 },
  { ano: 2027, matriculas: CMP.matriculas27, iqe: CMP.iqe27, ae: CMP.ae27, total: CMP.total27 },
] as const;

export interface ResultadoComparativo {
  anos: number[];
  registros: number;
  instituicoesIgnoradas: string[];
  somaPorAno: { ano: number; matriculas: number; iqe: number; ae: number; participacao: number }[];
  avisos: string[];
}

type Linha = { getCell(c: number): { value: unknown } };

export async function carregarComparativo(pastaAno: number): Promise<ResultadoComparativo> {
  const avisos: string[] = [];
  const arqCmp = exigirArquivo(
    relatorioIndicadores(pastaAno, "comparativo-institucional.xlsx"),
    `o comparativo institucional em "03 - Indicadores/${pastaAno}"`,
  );
  const arqPar = relatorioIndicadores(pastaAno, "participacao-percentual.xlsx");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arqCmp);
  const ws = wb.getWorksheet("Comparativo");
  if (!ws) throw new Error('A planilha não tem a aba "Comparativo".');

  const instituicoes = await prisma.instituicao.findMany({ select: { id: true, sigla: true } });
  const idPorSigla = new Map(instituicoes.map((i) => [i.sigla, i.id]));

  // Uma FonteDados por ciclo, todas apontando para o mesmo arquivo: o dado de cada
  // ano tem de poder ser rastreado sozinho, mesmo vindo de uma exportação única.
  const checksum = checksumArquivo(arqCmp);
  const nomeArquivo = arqCmp.split(/[\\/]/).pop() ?? arqCmp;
  const fontePorAno = new Map<number, number>();
  for (const c of CICLOS) {
    await prisma.comparativoInstitucional.deleteMany({ where: { ano: c.ano } });
    const f = await prisma.fonteDados.create({
      data: {
        origem: "MDO_IFTM",
        // Não é uma das sete fases: é um relatório derivado delas.
        cicloOrcamento: c.ano,
        arquivo: nomeArquivo,
        abrangencia: "REDE",
        checksum,
        ressalva:
          "Relatório interanual: o mesmo arquivo traz 2026 e 2027, e é idêntico nas pastas dos dois anos. " +
          "Só o nível de instituição é carregado; o arquivo que desce a câmpus tem valores trocados de unidade.",
      },
    });
    fontePorAno.set(c.ano, f.id);
  }

  const registros = new Map<string, Prisma.ComparativoInstitucionalCreateManyInput>();
  const ignoradas = new Set<string>();

  ws.eachRow((linha) => {
    const l = linha as Linha;
    const sigla = texto(l.getCell(CMP.sigla).value);
    if (!sigla || sigla.toUpperCase() === "SIGLA") return;

    // A planilha abre com uma linha solta de cabeçalho ("Ano(s) selecionado(s): 2026,
    // 2027") que cai na coluna da sigla. Reconhecer isso pelo formato evita anunciar
    // um cabeçalho como se fosse uma instituição desconhecida.
    const temAlgumValor = CICLOS.some(
      (c) => numero(l.getCell(c.matriculas).value) || numero(l.getCell(c.iqe).value) || numero(l.getCell(c.ae).value),
    );
    if (!temAlgumValor) return;

    const instituicaoId = idPorSigla.get(sigla);
    if (instituicaoId === undefined) {
      ignoradas.add(sigla);
      return;
    }
    const posicao = numero(l.getCell(CMP.posicao).value);
    for (const c of CICLOS) {
      const matriculas = numero(l.getCell(c.matriculas).value);
      const iqe = numero(l.getCell(c.iqe).value);
      const ae = numero(l.getCell(c.ae).value);
      const total = numero(l.getCell(c.total).value);
      // Instituição que não existia no ciclo (o IF do Sertão Paraibano em 2026) vem
      // com tudo zerado; gravar isso seria afirmar que ela recebeu zero, e não que
      // ela não estava lá.
      if (!matriculas && !iqe && !ae && !total) continue;
      registros.set(`${c.ano}::${sigla}`, {
        ano: c.ano,
        instituicaoId,
        fonteDadosId: fontePorAno.get(c.ano)!,
        matriculas,
        iqe,
        ae,
        totalSpo: total,
        posicaoRede: posicao ? Math.round(posicao) : null,
      });
    }
  });

  // A participação percentual vem em arquivo separado, uma linha por (ano, instituição).
  try {
    const wbPar = new ExcelJS.Workbook();
    await wbPar.xlsx.readFile(arqPar);
    const wsPar = wbPar.getWorksheet("Participação");
    if (!wsPar) throw new Error('sem a aba "Participação"');
    wsPar.eachRow((linha) => {
      const l = linha as Linha;
      const ano = numero(l.getCell(PAR.ano).value);
      const sigla = texto(l.getCell(PAR.sigla).value);
      if (!ano || !sigla) return;
      const alvo = registros.get(`${Math.round(ano)}::${sigla}`);
      if (!alvo) return;
      alvo.participacaoPercentual = numero(l.getCell(PAR.percentual).value);
      const ranking = numero(l.getCell(PAR.ranking).value);
      if (ranking) alvo.posicaoRede = Math.round(ranking);
    });
  } catch (erro) {
    avisos.push(
      `Não consegui ler a participação percentual (${erro instanceof Error ? erro.message : String(erro)}). ` +
        "Os valores em reais foram carregados assim mesmo.",
    );
  }

  const lista = Array.from(registros.values());
  if (lista.length > 0) await prisma.comparativoInstitucional.createMany({ data: lista });

  if (ignoradas.size > 0) {
    avisos.push(
      `Instituições do relatório sem cadastro no sistema, ignoradas: ${Array.from(ignoradas).join(", ")}.`,
    );
  }

  const somaPorAno = CICLOS.map((c) => {
    const doAno = lista.filter((r) => r.ano === c.ano);
    const soma = (campo: keyof Prisma.ComparativoInstitucionalCreateManyInput) =>
      doAno.reduce((acc, r) => acc + Number(r[campo] ?? 0), 0);
    return {
      ano: c.ano,
      matriculas: soma("matriculas"),
      iqe: soma("iqe"),
      ae: soma("ae"),
      participacao: soma("participacaoPercentual"),
    };
  });

  // A participação é fatia da rede: tem de somar 100 em cada ciclo.
  for (const s of somaPorAno) {
    if (s.participacao > 0 && Math.abs(s.participacao - 100) > 0.5) {
      avisos.push(`A participação percentual de ${s.ano} soma ${s.participacao.toFixed(2)}%, e deveria somar 100%.`);
    }
  }

  return {
    anos: CICLOS.map((c) => c.ano),
    registros: lista.length,
    instituicoesIgnoradas: Array.from(ignoradas),
    somaPorAno,
    avisos,
  };
}
