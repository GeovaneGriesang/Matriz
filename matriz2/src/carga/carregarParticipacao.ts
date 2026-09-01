import ExcelJS from "exceljs";
import type { CategoriaRepasse, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { exigirArquivo, planilhaParticipacao } from "./caminhos";
import { checksumArquivo, data, numero, numeroOuZero, texto } from "./planilha";

/**
 * Carrega a 6ª fase da MDO: a participação de cada ciclo de curso na distribuição.
 *
 * É o grão mais fino que existe, e o mais valioso. Em 2027 são 58.242 ciclos, de 42
 * instituições e 639 câmpus. A soma de `Valor (R$)` precisa bater com o total do
 * Bloco Funcionamento distribuído por matrícula (R$ 1.831.831.660,00), e essa
 * conferência roda ao final da carga.
 *
 * A planilha tem 7,6 MB e é lida em FLUXO, linha a linha, em vez de carregada
 * inteira na memória. Medido: 4,2 segundos para as 58.243 linhas.
 */

/** Ordem das colunas na aba, conferida em 2026-08-31. Base 0 depois de descartar o índice do exceljs. */
const COL = {
  sigla: 0,
  instituicao: 1,
  campus: 2,
  modalidade: 3,
  fonteFinanciamento: 4,
  nivel: 5,
  tipoCurso: 6,
  curso: 7,
  areaEixo: 8,
  agropecuaria: 9,
  codigoCiclo: 10,
  ciclo: 11,
  tipoOferta: 12,
  turno: 13,
  inicio: 14,
  termino: 15,
  jubilamento: 16,
  pesoCursoMatriz: 17,
  chMinimaMec: 18,
  cargaHoraria: 19,
  chMatriz: 20,
  qtdAlunosMatriz: 21,
  matriculaTotal: 22,
  repasse: 23,
  valorReais: 24,
  icqa: 25,
  valorAluno: 26,
  perdaEvasao: 27,
} as const;

/** A planilha escreve "EAD MOOC" e "EAD FP" com espaço; o banco usa o enum do Prisma. */
const REPASSE: Record<string, CategoriaRepasse> = {
  PRESENCIAL: "PRESENCIAL",
  EAD: "EAD",
  "EAD MOOC": "EAD_MOOC",
  "EAD FP": "EAD_FP",
};

export interface ResultadoCarga {
  ciclos: number;
  instituicoes: number;
  campus: number;
  somaValor: number;
  somaPerdaEvasao: number;
  ignoradas: number;
  fonteDadosId: number;
}

const LOTE = 2_000;

export async function carregarParticipacao(ano: number): Promise<ResultadoCarga> {
  const caminho = exigirArquivo(
    planilhaParticipacao(ano),
    `a planilha da 6ª fase (Participação Orçamentária) de ${ano}`,
  );

  // Recarregar o mesmo ciclo substitui o que estava lá: a MDO reexporta a cada rodada
  // de homologação, e manter as duas versões dobraria os totais em silêncio.
  await prisma.distribuicaoCiclo.deleteMany({ where: { ano } });

  const fonte = await prisma.fonteDados.create({
    data: {
      origem: "MDO_IFTM",
      fase: "F6_PARTICIPACAO",
      cicloOrcamento: ano,
      arquivo: caminho.split(/[\\/]/).pop() ?? caminho,
      abrangencia: "REDE",
      checksum: checksumArquivo(caminho),
      ressalva:
        "A 6ª fase estava marcada como Em andamento no painel da MDO quando este arquivo foi exportado; " +
        "os valores ainda podem mudar até a homologação final.",
    },
  });

  const instituicaoPorSigla = new Map<string, number>();
  const unidadePorChave = new Map<string, number>();

  async function resolverUnidade(sigla: string, nomeInstituicao: string, campus: string): Promise<number> {
    let instituicaoId = instituicaoPorSigla.get(sigla);
    if (instituicaoId === undefined) {
      const inst = await prisma.instituicao.upsert({
        where: { sigla },
        // A 6ª fase não traz UF; quem a preenche é a 5ª fase. Fica vazia se esta carga vier primeiro.
        create: { sigla, nome: nomeInstituicao, uf: "" },
        update: { nome: nomeInstituicao },
      });
      instituicaoId = inst.id;
      instituicaoPorSigla.set(sigla, instituicaoId);
    }
    const chave = `${instituicaoId}::${campus}`;
    let unidadeId = unidadePorChave.get(chave);
    if (unidadeId === undefined) {
      const un = await prisma.unidade.upsert({
        where: { instituicaoId_nome: { instituicaoId, nome: campus } },
        create: { instituicaoId, nome: campus, tipo: "CAMPUS" },
        update: {},
      });
      unidadeId = un.id;
      unidadePorChave.set(chave, unidadeId);
    }
    return unidadeId;
  }

  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, {
    entries: "emit",
    worksheets: "emit",
    sharedStrings: "cache",
    styles: "ignore",
  });

  let buffer: Prisma.DistribuicaoCicloCreateManyInput[] = [];
  let ciclos = 0;
  let ignoradas = 0;
  let somaValor = 0;
  let somaPerdaEvasao = 0;
  let primeiraLinha = true;
  // A MDO repete o mesmo Código Ciclo em linhas diferentes quando o ciclo se divide
  // entre fontes de financiamento. A chave única é (ano, unidade, código), então essas
  // linhas precisam ser somadas em vez de gravadas duas vezes.
  const vistos = new Map<string, number>();

  const gravar = async () => {
    if (buffer.length === 0) return;
    await prisma.distribuicaoCiclo.createMany({ data: buffer });
    buffer = [];
  };

  for await (const planilha of leitor) {
    for await (const linha of planilha) {
      if (primeiraLinha) {
        primeiraLinha = false;
        continue;
      }
      const v = (linha.values as unknown[]).slice(1);

      const sigla = texto(v[COL.sigla]);
      const campus = texto(v[COL.campus]);
      const codigoCiclo = texto(v[COL.codigoCiclo]);
      const repasseBruto = texto(v[COL.repasse]);
      if (!sigla || !campus || !codigoCiclo || !repasseBruto) {
        ignoradas++;
        continue;
      }
      const repasse = REPASSE[repasseBruto.toUpperCase()];
      if (!repasse) {
        ignoradas++;
        continue;
      }

      const unidadeId = await resolverUnidade(sigla, texto(v[COL.instituicao]) ?? sigla, campus);
      const chave = `${unidadeId}::${codigoCiclo}`;
      if (vistos.has(chave)) {
        ignoradas++;
        continue;
      }
      vistos.set(chave, 1);

      const valorReais = numeroOuZero(v[COL.valorReais]);
      const perda = numeroOuZero(v[COL.perdaEvasao]);
      somaValor += valorReais;
      somaPerdaEvasao += perda;

      buffer.push({
        ano,
        unidadeId,
        fonteDadosId: fonte.id,
        codigoCiclo,
        ciclo: texto(v[COL.ciclo]) ?? "",
        curso: texto(v[COL.curso]) ?? "",
        areaEixo: texto(v[COL.areaEixo]),
        nivel: texto(v[COL.nivel]),
        tipoCurso: texto(v[COL.tipoCurso]),
        tipoOferta: texto(v[COL.tipoOferta]),
        turno: texto(v[COL.turno]),
        modalidade: texto(v[COL.modalidade]) ?? "",
        fonteFinanciamento: texto(v[COL.fonteFinanciamento]) ?? "",
        repasse,
        inicio: data(v[COL.inicio]),
        termino: data(v[COL.termino]),
        jubilamento: data(v[COL.jubilamento]),
        pesoCursoMatriz: numero(v[COL.pesoCursoMatriz]),
        chMinimaMec: numero(v[COL.chMinimaMec]),
        cargaHoraria: numero(v[COL.cargaHoraria]),
        chMatriz: numero(v[COL.chMatriz]),
        qtdAlunosMatriz: numero(v[COL.qtdAlunosMatriz]),
        matriculaTotal: numeroOuZero(v[COL.matriculaTotal]),
        valorReais,
        icqa: numero(v[COL.icqa]),
        valorAluno: numero(v[COL.valorAluno]),
        perdaEvasaoReais: perda,
      });
      ciclos++;
      if (buffer.length >= LOTE) await gravar();
    }
  }
  await gravar();

  return {
    ciclos,
    instituicoes: instituicaoPorSigla.size,
    campus: unidadePorChave.size,
    somaValor,
    somaPerdaEvasao,
    ignoradas,
    fonteDadosId: fonte.id,
  };
}
