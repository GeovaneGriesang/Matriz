import ExcelJS from "exceljs";
import { nomeCanonicoDaUnidade } from "@/lib/nomesDeUnidade";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { conferenciaExtracaoCiclos } from "./caminhos";
import { checksumArquivo, data, numero, numeroOuZero, texto } from "./planilha";

/**
 * Carrega a 2ª fase da MDO no grão de CICLO DE CURSO: uma aba por câmpus, com a
 * matrícula de cada ciclo aberta por situação e por faixa de renda familiar, mais a
 * aba INDICADORES com os indicadores da PNP das 42 instituições.
 *
 * Só existe para o IFSul. É o único arquivo que responde "quantos alunos deste ciclo
 * concluíram, ficaram retidos ou evadiram", a pergunta por trás da Matrícula Total: a
 * 6ª fase diz quanto o ciclo recebe, esta diz o que aconteceu com os alunos dele.
 * Liga-se à 6ª fase pelo código do ciclo (a coluna "Ciclo da matrícula").
 */

/** Colunas das abas de câmpus, conferidas em 2026-09-29. Cabeçalho na linha 7, dados da 8 em diante. */
const COL = {
  campus: 1,
  codigoCiclo: 3,
  nomeCiclo: 4,
  modalidade: 5,
  financiamento: 6,
  tipoCurso: 7,
  curso: 8,
  areaEixo: 9,
  agropecuaria: 10,
  tipoOferta: 11,
  inicio: 12,
  previstoTermino: 13,
  chHoraria: 14,
  chHorariaMec: 15,
  chMatriz: 16,
  concluida: 17,
  integralizada: 18,
  emFluxo: 19,
  retido: 20,
  abandono: 21,
  cancelada: 22,
  desligada: 23,
  reprovada: 24,
  substituido: 25,
  transfExterna: 26,
  transfInterna: 27,
  qtdMatriculas: 28,
  rendaNaoDeclarada: 30,
  rendaAte05: 31,
  renda05a10: 32,
  renda10a15: 33,
  renda15a25: 34,
  renda25a35: 35,
  rendaAcima35: 36,
} as const;

/** Colunas da aba INDICADORES. */
const IND = {
  sigla: 5,
  ieaConclusao: 7,
  ieaEvasao: 8,
  ieaRetencao: 9,
  ieaEficiencia: 10,
  rapPresencial: 12,
  matriculaEqRap: 13,
  professorEquivalente: 14,
  meTecnicos: 16,
  meFormacao: 17,
  meProeja: 18,
} as const;

const PRIMEIRA_LINHA_DADOS = 8;
const LOTE = 1_000;

export interface ResultadoConferenciaCiclos {
  sigla: string;
  arquivo: string;
  campus: number;
  ciclos: number;
  somaQtdMatriculas: number;
  indicadores: number;
  /** Ciclos da planilha que não existem na 6ª fase carregada do mesmo ciclo orçamentário. */
  semParNaSextaFase: number;
  ignoradas: number;
  avisos: string[];
}

export async function carregarConferenciaCiclos(
  ano: number,
  sigla: string,
): Promise<ResultadoConferenciaCiclos | null> {
  const caminho = conferenciaExtracaoCiclos(ano, sigla);
  if (!caminho) return null;
  const avisos: string[] = [];

  const instituicao = await prisma.instituicao.findUnique({ where: { sigla } });
  if (!instituicao) {
    return {
      sigla,
      arquivo: caminho,
      campus: 0,
      ciclos: 0,
      somaQtdMatriculas: 0,
      indicadores: 0,
      semParNaSextaFase: 0,
      ignoradas: 0,
      avisos: [`Instituição ${sigla} ainda não existe no banco; carregue a 5ª fase antes.`],
    };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);

  const unidades = await prisma.unidade.findMany({
    where: { instituicaoId: instituicao.id },
    select: { id: true, nome: true },
  });
  const unidadePorNome = new Map(unidades.map((u) => [u.nome.trim().toUpperCase(), u.id]));

  await prisma.conferenciaCiclo.deleteMany({ where: { ano, unidade: { instituicaoId: instituicao.id } } });
  await prisma.indicadoresPnpInstituicao.deleteMany({ where: { ano } });

  const nomeArquivo = caminho.split(/[\\/]/).pop() ?? caminho;
  const anoPnpNoNome = nomeArquivo.match(/_(\d{4})\.xlsx$/)?.[1];
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
        "Os ciclos e a matrícula por situação são só do IFSul. A aba INDICADORES traz as 42 instituições, " +
        `com a PNP de ${anoPnpNoNome ?? "ano não identificado"}.`,
    },
  });

  const ciclosDaSextaFase = new Set(
    (
      await prisma.distribuicaoCiclo.findMany({
        where: { ano, unidade: { instituicaoId: instituicao.id } },
        select: { unidadeId: true, codigoCiclo: true },
      })
    ).map((c) => `${c.unidadeId}::${c.codigoCiclo}`),
  );

  const porChave = new Map<string, Prisma.ConferenciaCicloCreateManyInput>();
  const campusVistos = new Set<number>();
  let ignoradas = 0;
  let semParNaSextaFase = 0;
  let somaQtdMatriculas = 0;

  for (const ws of wb.worksheets) {
    if (ws.name.trim().toUpperCase() === "INDICADORES") continue;
    ws.eachRow((linha, numeroLinha) => {
      if (numeroLinha < PRIMEIRA_LINHA_DADOS) return;
      const v = (c: number) => linha.getCell(c).value;
      const campus = texto(v(COL.campus));
      const codigoCiclo = texto(v(COL.codigoCiclo));
      if (!campus || !codigoCiclo) return;
      const unidadeId = unidadePorNome.get(nomeCanonicoDaUnidade(campus).toUpperCase());
      if (unidadeId === undefined) {
        ignoradas++;
        return;
      }
      campusVistos.add(unidadeId);
      const financiamento = texto(v(COL.financiamento)) ?? "";
      const chave = `${unidadeId}::${codigoCiclo}::${financiamento}`;
      const n = (c: number) => numeroOuZero(v(c));

      const novo: Prisma.ConferenciaCicloCreateManyInput = {
        ano,
        unidadeId,
        fonteDadosId: fonte.id,
        codigoCiclo,
        nomeCiclo: texto(v(COL.nomeCiclo)) ?? "",
        modalidade: texto(v(COL.modalidade)) ?? "",
        financiamento,
        tipoCurso: texto(v(COL.tipoCurso)) ?? "",
        curso: texto(v(COL.curso)) ?? "",
        areaEixo: texto(v(COL.areaEixo)),
        agropecuaria: texto(v(COL.agropecuaria))?.toUpperCase() === "SIM",
        tipoOferta: texto(v(COL.tipoOferta)),
        inicio: data(v(COL.inicio)),
        previstoTermino: data(v(COL.previstoTermino)),
        chHoraria: numero(v(COL.chHoraria)),
        chHorariaMec: numero(v(COL.chHorariaMec)),
        chMatriz: numero(v(COL.chMatriz)),
        concluida: n(COL.concluida),
        integralizada: n(COL.integralizada),
        emFluxo: n(COL.emFluxo),
        retido: n(COL.retido),
        abandono: n(COL.abandono),
        cancelada: n(COL.cancelada),
        desligada: n(COL.desligada),
        reprovada: n(COL.reprovada),
        substituido: n(COL.substituido),
        transfExterna: n(COL.transfExterna),
        transfInterna: n(COL.transfInterna),
        qtdMatriculas: n(COL.qtdMatriculas),
        rendaNaoDeclarada: n(COL.rendaNaoDeclarada),
        rendaAte05: n(COL.rendaAte05),
        renda05a10: n(COL.renda05a10),
        renda10a15: n(COL.renda10a15),
        renda15a25: n(COL.renda15a25),
        renda25a35: n(COL.renda25a35),
        rendaAcima35: n(COL.rendaAcima35),
      };
      const existente = porChave.get(chave);
      if (existente) {
        // Mesmo ciclo repetido com o mesmo financiamento: soma, em vez de perder linhas.
        for (const campo of [
          "concluida", "integralizada", "emFluxo", "retido", "abandono", "cancelada", "desligada",
          "reprovada", "substituido", "transfExterna", "transfInterna", "qtdMatriculas",
          "rendaNaoDeclarada", "rendaAte05", "renda05a10", "renda10a15", "renda15a25", "renda25a35", "rendaAcima35",
        ] as const) {
          existente[campo] = Number(existente[campo] ?? 0) + Number(novo[campo] ?? 0);
        }
      } else {
        porChave.set(chave, novo);
      }
    });
  }

  const linhasParaGravar = [...porChave.values()];
  for (const l of linhasParaGravar) {
    somaQtdMatriculas += Number(l.qtdMatriculas ?? 0);
    if (!ciclosDaSextaFase.has(`${l.unidadeId}::${l.codigoCiclo}`)) semParNaSextaFase++;
  }
  for (let i = 0; i < linhasParaGravar.length; i += LOTE) {
    await prisma.conferenciaCiclo.createMany({ data: linhasParaGravar.slice(i, i + LOTE) });
  }

  // ---- Aba INDICADORES (rede inteira) ----
  let indicadores = 0;
  const wsIndicadores = wb.worksheets.find((w) => w.name.trim().toUpperCase() === "INDICADORES");
  if (wsIndicadores) {
    const instituicoes = await prisma.instituicao.findMany({ select: { id: true, sigla: true } });
    const idPorSigla = new Map(instituicoes.map((i) => [i.sigla.toUpperCase(), i.id]));
    const paraGravar: Prisma.IndicadoresPnpInstituicaoCreateManyInput[] = [];
    const naoEncontradas: string[] = [];
    wsIndicadores.eachRow((linha, numeroLinha) => {
      if (numeroLinha < 11) return;
      const siglaLinha = texto(linha.getCell(IND.sigla).value);
      if (!siglaLinha) return;
      const id = idPorSigla.get(siglaLinha.toUpperCase());
      if (id === undefined) {
        naoEncontradas.push(siglaLinha);
        return;
      }
      const n = (c: number) => numero(linha.getCell(c).value);
      paraGravar.push({
        ano,
        instituicaoId: id,
        fonteDadosId: fonte.id,
        ieaConclusao: n(IND.ieaConclusao),
        ieaEvasao: n(IND.ieaEvasao),
        ieaRetencao: n(IND.ieaRetencao),
        ieaEficiencia: n(IND.ieaEficiencia),
        rapPresencial: n(IND.rapPresencial),
        matriculaEqRap: n(IND.matriculaEqRap),
        professorEquivalente: n(IND.professorEquivalente),
        meTecnicos: n(IND.meTecnicos),
        meFormacao: n(IND.meFormacao),
        meProeja: n(IND.meProeja),
      });
    });
    if (paraGravar.length > 0) await prisma.indicadoresPnpInstituicao.createMany({ data: paraGravar });
    indicadores = paraGravar.length;
    if (naoEncontradas.length > 0) avisos.push(`Siglas da aba INDICADORES sem instituição no banco: ${naoEncontradas.join(", ")}.`);

    // Conferência com a 5ª fase: os indicadores da PNP devem coincidir com os que a
    // proposta usou para calcular o Bloco Qualidade e Eficiência.
    const daProposta = await prisma.distribuicaoInstituicao.findMany({
      where: { ano },
      select: { instituicaoId: true, ieaEficiencia: true, rapPresencial: true },
    });
    const propostaPorId = new Map(daProposta.map((d) => [d.instituicaoId, d]));
    let comparadas = 0;
    let divergentes = 0;
    for (const p of paraGravar) {
      const d = propostaPorId.get(p.instituicaoId);
      if (!d || d.ieaEficiencia === null || p.ieaEficiencia === null || p.ieaEficiencia === undefined) continue;
      comparadas++;
      if (Math.abs(Number(d.ieaEficiencia) - Number(p.ieaEficiencia)) > 0.005) divergentes++;
    }
    if (comparadas > 0 && divergentes > 0) {
      avisos.push(
        `Eficiência acadêmica (IEA) diverge da 5ª fase em ${divergentes} de ${comparadas} instituições: ` +
          "os dois arquivos não vêm da mesma fotografia da PNP.",
      );
    }
  }

  if (semParNaSextaFase > 0) {
    avisos.push(
      `${semParNaSextaFase} ciclo(s) desta conferência não existem na 6ª fase de ${ano} (ciclos já encerrados ou fora da matriz).`,
    );
  }
  if (ignoradas > 0) avisos.push(`${ignoradas} linha(s) de câmpus sem unidade no banco foram ignoradas.`);

  return {
    sigla,
    arquivo: nomeArquivo,
    campus: campusVistos.size,
    ciclos: linhasParaGravar.length,
    somaQtdMatriculas,
    indicadores,
    semParNaSextaFase,
    ignoradas,
    avisos,
  };
}
