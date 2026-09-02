import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { conferenciaExtracao, existe } from "./caminhos";
import { checksumArquivo, numero, texto } from "./planilha";

/**
 * Carrega a 2ª fase da MDO: a Conferência da Extração da PNP, homologada por cada
 * instituição. Traz, por câmpus, a matrícula aberta por situação, a evasão aberta por
 * motivo e a distribuição de renda familiar.
 *
 * É o primeiro conjunto do sistema que **não cobre a rede**: só temos o arquivo do
 * IFSul. Por isso a `FonteDados` sai com `abrangencia: INSTITUICAO` e aponta a
 * instituição dona, o que impede uma consulta de rede de somar 14 câmpus achando que
 * somou 639.
 */

/** Colunas da aba, conferidas em 2026-09-02. Cabeçalho em duas linhas; dados a partir da 3. */
const COL = {
  campus: 1,
  concluido: 2,
  integralizado: 3,
  emCurso: 4,
  retido: 5,
  matriz: 6,
  abandono: 7,
  desligado: 8,
  reprovado: 9,
  transfExterna: 10,
  transfInterna: 11,
  rendaNaoDeclarada: 12,
  rendaAte05: 13,
  renda05a10: 14,
  renda10a15: 15,
  renda15a25: 16,
  renda25a35: 17,
  rendaAcima35: 18,
  rendaTotal: 19,
  rendaPonderada: 26,
} as const;

export interface ResultadoConferencia {
  ano: number;
  campus: number;
  naoEncontrados: string[];
  somaMatriz: number;
  somaEvasao: number;
  avisos: string[];
}

type Linha = { getCell(c: number): { value: unknown } };

export async function carregarConferencia(ano: number, sigla: string): Promise<ResultadoConferencia | null> {
  const caminho = conferenciaExtracao(ano, sigla);
  if (!caminho || !existe(caminho)) return null;

  const avisos: string[] = [];
  const instituicao = await prisma.instituicao.findUnique({ where: { sigla } });
  if (!instituicao) {
    return {
      ano,
      campus: 0,
      naoEncontrados: [],
      somaMatriz: 0,
      somaEvasao: 0,
      avisos: [`Instituição ${sigla} ainda não existe no banco; carregue a 5ª fase antes.`],
    };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("A planilha não tem nenhuma aba.");

  const unidades = await prisma.unidade.findMany({
    where: { instituicaoId: instituicao.id },
    select: { id: true, nome: true },
  });
  const idPorNome = new Map(unidades.map((u) => [u.nome.trim().toUpperCase(), u.id]));

  await prisma.conferenciaExtracao.deleteMany({
    where: { ano, unidade: { instituicaoId: instituicao.id } },
  });

  const nomeArquivo = caminho.split(/[\\/]/).pop() ?? caminho;
  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F2_CONFERENCIA_EXTRACAO",
      cicloOrcamento: ano,
      arquivo: nomeArquivo,
      abrangencia: "INSTITUICAO",
      instituicaoId: instituicao.id,
      checksum: checksumArquivo(caminho),
      ressalva:
        "As pastas de 2026 e 2027 contêm o MESMO arquivo, ambos nomeados \"..._2025\", quando o ciclo " +
        "2026 deveria usar a PNP de 2024. O seletor de ano não pegou nesta exportação, então os dois " +
        "ciclos ficam com os números da PNP de 2025 até uma reexportação.",
    },
  });

  const paraGravar: Prisma.ConferenciaExtracaoCreateManyInput[] = [];
  const naoEncontrados: string[] = [];

  ws.eachRow((linha, numeroLinha) => {
    if (numeroLinha < 3) return;
    const l = linha as Linha;
    const campus = texto(l.getCell(COL.campus).value);
    // A planilha fecha com uma linha "TOTAL", que não é câmpus e não deve virar
    // aviso de unidade ausente.
    const rotulo = campus?.toUpperCase();
    if (!campus || rotulo === "CAMPUS" || rotulo === "TOTAL") return;
    const unidadeId = idPorNome.get(campus.toUpperCase());
    if (unidadeId === undefined) {
      naoEncontrados.push(campus);
      return;
    }
    const n = (c: number) => numero(l.getCell(c).value);
    paraGravar.push({
      ano,
      unidadeId,
      fonteDadosId: fonte.id,
      concluido: n(COL.concluido),
      integralizado: n(COL.integralizado),
      emCurso: n(COL.emCurso),
      retido: n(COL.retido),
      matriz: n(COL.matriz),
      abandono: n(COL.abandono),
      desligado: n(COL.desligado),
      reprovado: n(COL.reprovado),
      transfExterna: n(COL.transfExterna),
      transfInterna: n(COL.transfInterna),
      rendaNaoDeclarada: n(COL.rendaNaoDeclarada),
      rendaAte05: n(COL.rendaAte05),
      renda05a10: n(COL.renda05a10),
      renda10a15: n(COL.renda10a15),
      renda15a25: n(COL.renda15a25),
      renda25a35: n(COL.renda25a35),
      rendaAcima35: n(COL.rendaAcima35),
      rendaTotal: n(COL.rendaTotal),
      rendaPonderada: n(COL.rendaPonderada),
    });
  });

  if (paraGravar.length > 0) await prisma.conferenciaExtracao.createMany({ data: paraGravar });
  if (naoEncontrados.length > 0) {
    avisos.push(`Câmpus da planilha sem correspondente no banco: ${naoEncontrados.join(", ")}.`);
  }

  const somaMatriz = paraGravar.reduce((s, r) => s + Number(r.matriz ?? 0), 0);
  const somaEvasao = paraGravar.reduce(
    (s, r) =>
      s +
      Number(r.abandono ?? 0) +
      Number(r.desligado ?? 0) +
      Number(r.reprovado ?? 0) +
      Number(r.transfExterna ?? 0) +
      Number(r.transfInterna ?? 0),
    0,
  );

  return { ano, campus: paraGravar.length, naoEncontrados, somaMatriz, somaEvasao, avisos };
}
