import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { conferenciaExtracaoAluno, existe } from "./caminhos";
import { checksumArquivo, data, numero, texto } from "./planilha";

/**
 * Carrega a 2ª fase da MDO no nível MAIS FINO que existe: um registro por matrícula
 * de aluno (206.700 linhas para o IFSul).
 *
 * NUNCA exponha o que este módulo grava numa rota, página ou API pública. É dado
 * pessoal sob a LGPD (câmpus + curso + datas + faixa de renda combinados podem
 * reidentificar um aluno em turma pequena), carregado só para auditoria e
 * conferência interna, por decisão do usuário em 2026-09-03. Ver o aviso completo em
 * `ConferenciaExtracaoAluno` no schema.
 *
 * A planilha tem 12 MB e ~207 mil linhas espalhadas em 14 abas, uma por câmpus. É
 * lida em FLUXO, como a 6ª fase, para não carregar tudo na memória de uma vez.
 */

/** Colunas da aba, 0-indexadas após descartar o índice do exceljs. Idênticas nas 14 abas. */
const COL = {
  campus: 0,
  codigoCiclo: 1,
  nomeCiclo: 2,
  financiamento: 3,
  tipoCurso: 4,
  curso: 5,
  areaEixo: 6,
  agropecuaria: 7,
  tipoOferta: 8,
  inicio: 9,
  previstoTermino: 10,
  jubilamento: 11,
  chHoraria: 12,
  chHorariaMec: 13,
  chMatriz: 14,
  matriculaAluno: 15,
  renda: 16,
  situacaoMatricula: 17,
  situacaoMatriz: 18,
} as const;

export interface ResultadoConferenciaAluno {
  ano: number;
  registros: number;
  campus: number;
  naoEncontrados: string[];
  alunosDistintos: number;
  avisos: string[];
}

const LOTE = 2_000;

function paraInt(v: unknown): number | null {
  const n = numero(v);
  return n === null ? null : Math.round(n);
}

export async function carregarConferenciaAluno(ano: number, sigla: string): Promise<ResultadoConferenciaAluno | null> {
  const caminho = conferenciaExtracaoAluno(ano, sigla);
  if (!caminho || !existe(caminho)) return null;

  const avisos: string[] = [];
  const instituicao = await prisma.instituicao.findUnique({ where: { sigla } });
  if (!instituicao) {
    return {
      ano,
      registros: 0,
      campus: 0,
      naoEncontrados: [],
      alunosDistintos: 0,
      avisos: [`Instituição ${sigla} ainda não existe no banco; carregue a 5ª fase antes.`],
    };
  }

  const unidades = await prisma.unidade.findMany({
    where: { instituicaoId: instituicao.id },
    select: { id: true, nome: true },
  });
  const idPorNome = new Map(unidades.map((u) => [u.nome.trim().toUpperCase(), u.id]));

  await prisma.conferenciaExtracaoAluno.deleteMany({
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
        "Dado pessoal (LGPD): um registro por matrícula de aluno. Nunca exposto em tela pública, só para " +
        "auditoria interna. A pasta de 2027 traz, por engano da MDO, um arquivo com o nome de outro " +
        "relatório (conteúdo correto). O conteúdo é idêntico ao de 2026 — mesmo bug do seletor de ano que " +
        "afeta outras exportações da 2ª fase e os relatórios de Indicadores.",
    },
  });

  const naoEncontrados = new Set<string>();
  const camposVistos = new Set<number>();
  const alunosDistintos = new Set<string>();
  let buffer: Prisma.ConferenciaExtracaoAlunoCreateManyInput[] = [];
  let registros = 0;

  const gravar = async () => {
    if (buffer.length === 0) return;
    await prisma.conferenciaExtracaoAluno.createMany({ data: buffer });
    buffer = [];
  };

  const leitor = new ExcelJS.stream.xlsx.WorkbookReader(caminho, {
    entries: "emit",
    worksheets: "emit",
    sharedStrings: "cache",
    styles: "ignore",
  });

  for await (const planilha of leitor) {
    let primeiraLinha = true;
    for await (const linha of planilha) {
      if (primeiraLinha) {
        primeiraLinha = false;
        continue;
      }
      const v = (linha.values as unknown[]).slice(1);

      const campus = texto(v[COL.campus]);
      const matriculaAluno = texto(v[COL.matriculaAluno]);
      const codigoCiclo = texto(v[COL.codigoCiclo]);
      if (!campus || !matriculaAluno || !codigoCiclo) continue;

      const unidadeId = idPorNome.get(campus.toUpperCase());
      if (unidadeId === undefined) {
        naoEncontrados.add(campus);
        continue;
      }
      camposVistos.add(unidadeId);
      alunosDistintos.add(matriculaAluno);

      buffer.push({
        ano,
        unidadeId,
        fonteDadosId: fonte.id,
        codigoCiclo,
        nomeCiclo: texto(v[COL.nomeCiclo]) ?? "",
        financiamento: texto(v[COL.financiamento]) ?? "",
        tipoCurso: texto(v[COL.tipoCurso]) ?? "",
        curso: texto(v[COL.curso]) ?? "",
        areaEixo: texto(v[COL.areaEixo]),
        agropecuaria: texto(v[COL.agropecuaria])?.toUpperCase() === "SIM",
        tipoOferta: texto(v[COL.tipoOferta]),
        inicio: data(v[COL.inicio]),
        previstoTermino: data(v[COL.previstoTermino]),
        jubilamento: data(v[COL.jubilamento]),
        chHoraria: paraInt(v[COL.chHoraria]),
        chHorariaMec: paraInt(v[COL.chHorariaMec]),
        chMatriz: paraInt(v[COL.chMatriz]),
        matriculaAluno,
        renda: texto(v[COL.renda]),
        situacaoMatricula: texto(v[COL.situacaoMatricula]),
        situacaoMatriz: texto(v[COL.situacaoMatriz]),
      });
      registros++;
      if (buffer.length >= LOTE) await gravar();
    }
  }
  await gravar();

  if (naoEncontrados.size > 0) {
    avisos.push(`Câmpus da planilha sem correspondente no banco: ${Array.from(naoEncontrados).join(", ")}.`);
  }

  return {
    ano,
    registros,
    campus: camposVistos.size,
    naoEncontrados: Array.from(naoEncontrados),
    alunosDistintos: alunosDistintos.size,
    avisos,
  };
}
