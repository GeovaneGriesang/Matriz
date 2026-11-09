import { Prisma } from "@prisma/client";
import type { DadosDosExemplos } from "@/lib/exemplosDoGuia";
import { CONFIANCA } from "@/lib/confianca";
import { turmaEncerradaAntesDoAnoBase } from "@/lib/turmasRetidas";
import { prisma } from "@/server/db/prisma";
import { CICLO_QUE_CONTRIBUI } from "@/server/queries/cursosCampus";

const n = (v: unknown) => Number(v ?? 0);
const NOME_DO_CAMPUS = "CAMPUS VENÂNCIO AIRES";

/** Os valores de uma linha da PNP vêm num JSON, com o nome da medida como chave. */
function medida(valores: unknown, nome: string): number {
  const v = (valores as Record<string, unknown> | null)?.[nome];
  return typeof v === "number" ? v : 0;
}

/** Busca o que os exemplos do Guia das telas citam, do ciclo mais recente. */
export async function carregarDadosDosExemplos(): Promise<DadosDosExemplos> {
  const ciclo = await prisma.cicloOrcamento.findFirst({ orderBy: { ano: "desc" } });
  const ano = ciclo?.ano ?? new Date().getUTCFullYear();
  const [campus, instituicao] = await Promise.all([
    prisma.unidade.findFirst({ where: { nome: NOME_DO_CAMPUS }, select: { id: true } }),
    prisma.instituicao.findFirst({ where: { sigla: "IFSUL" }, select: { id: true } }),
  ]);
  const unidadeId = campus?.id ?? -1;
  const instituicaoId = instituicao?.id ?? -1;

  const [distAtual, distAnterior, recebido, recebidoNoAno, ciclos, ciclosQuarta, indicadores, arquivos, loa, usuarios, auditoria] = await Promise.all([
    prisma.distribuicaoCampus.findUnique({ where: { ano_unidadeId: { ano, unidadeId } }, select: { vlMatrFinal: true } }),
    prisma.distribuicaoCampus.findUnique({ where: { ano_unidadeId: { ano: ano - 1, unidadeId } }, select: { vlMatrFinal: true } }),
    prisma.valorRecebidoCampus.findFirst({ where: { ano: ano - 1, unidadeId }, select: { valorRecebido: true } }),
    prisma.valorRecebidoCampus.findFirst({ where: { ano, unidadeId }, select: { valorRecebido: true } }),
    prisma.distribuicaoCiclo.findMany({
      where: { ano, unidadeId, ...CICLO_QUE_CONTRIBUI },
      orderBy: { valorReais: "desc" },
      select: { curso: true, repasse: true, termino: true, valorReais: true, perdaEvasaoReais: true, qtdAlunosMatriz: true, pesoCursoMatriz: true, chMatriz: true, valorAluno: true },
    }),
    // Pode haver mais de uma exportação carregada: vale a mais recente, a mesma que a tela mostra.
    prisma.quartaFaseCiclo.groupBy({ by: ["fonteDadosId"], where: { resultadosPlanilha: { not: Prisma.DbNull } }, _count: { _all: true }, orderBy: { fonteDadosId: "desc" }, take: 1 }),
    prisma.distribuicaoInstituicao.findFirst({ where: { ano, instituicaoId }, select: { ieaEficiencia: true, rapPresencial: true } }),
    prisma.fonteDados.count(),
    prisma.orcamentoLoaTotal.findFirst({ where: { instituicaoId, documento: "LOA" }, orderBy: { exercicio: "desc" }, select: { exercicio: true, valor: true } }),
    prisma.usuario.count({ where: { ativo: true } }),
    prisma.registroAuditoria.count(),
  ]);

  const retidas = ciclos.filter((c) => turmaEncerradaAntesDoAnoBase(c.termino, ano));
  const regular = ciclos.find((c) => !turmaEncerradaAntesDoAnoBase(c.termino, ano) && c.repasse === "PRESENCIAL" && n(c.qtdAlunosMatriz) > 0 && c.chMatriz && c.pesoCursoMatriz && c.valorAluno);
  const ultima = ciclos.filter((c) => c.termino).sort((a, b) => b.termino!.getTime() - a.termino!.getTime())[0];

  // O curso de maior valor do câmpus pode não existir em outro: procura, em ordem de valor, o primeiro que exista.
  let outroCampus: DadosDosExemplos["outroCampus"] = null;
  for (const c of ciclos.filter((t) => !turmaEncerradaAntesDoAnoBase(t.termino, ano)).slice(0, 15)) {
    const outro = await prisma.distribuicaoCiclo.findFirst({
      where: { ano, curso: c.curso, unidadeId: { not: unidadeId }, unidade: { instituicaoId }, ...CICLO_QUE_CONTRIBUI },
      orderBy: { valorReais: "desc" },
      select: { valorReais: true, unidade: { select: { nome: true } } },
    });
    if (outro) {
      outroCampus = { curso: c.curso, valorAqui: n(c.valorReais), campus: outro.unidade.nome.replace(/^CAMPUS( AVANÇADO)? /, ""), valor: n(outro.valorReais) };
      break;
    }
  }

  const anoBase = ano - 2;
  const estruturaDoIfsul = await prisma.pnpEstrutura.findFirst({ where: { nivel: "INSTITUICAO", instituicaoId }, select: { id: true } }).catch(() => null);
  const [fatosPnp, fatoOrcamento] = estruturaDoIfsul
    ? await Promise.all([
        prisma.pnpFato.findMany({ where: { estruturaId: estruturaDoIfsul.id, anoBase, aba: "Dados Gerais", subaba: "Curso, Matrícula e Oferta", dimensao: "Eixo Tecnológico" }, select: { valores: true } }),
        prisma.pnpOrcamentoFato.findFirst({ where: { estruturaId: estruturaDoIfsul.id, anoBase, subaba: "Execução do Exercício", relacaoOrgao: "Órgão da UO", dimensao: "Ação Orçamentária", valorDimensao: { startsWith: "20RL" }, mes: "", tipoValor: "" }, select: { valores: true } }),
      ])
    : [[], null];
  const matriculasPnp = fatosPnp.reduce((s, f) => s + medida(f.valores, "Matrículas"), 0);
  const empenhado = fatoOrcamento ? medida(fatoOrcamento.valores, "Despesa empenhada") : 0;

  const itensDeConfianca = Object.values(CONFIANCA);
  const quantos = (nivel: string) => itensDeConfianca.filter((i) => i.nivel === nivel).length;

  return {
    ano,
    rede: ciclo ? { referencia: n(ciclo.valorReferenciaSpo), assistencia: n(ciclo.assistenciaTotal), funcionamento: n(ciclo.funcionamentoTotal) } : null,
    matriz: distAtual?.vlMatrFinal ? n(distAtual.vlMatrFinal) : null,
    matrizAnterior: distAnterior?.vlMatrFinal ? n(distAnterior.vlMatrFinal) : null,
    recebidoAnterior: recebido ? n(recebido.valorRecebido) : null,
    recebidoAtual: recebidoNoAno ? n(recebidoNoAno.valorRecebido) : null,
    turmas:
      ciclos.length > 0
        ? {
            quantidade: ciclos.length,
            somaValor: ciclos.reduce((s, c) => s + n(c.valorReais), 0),
            somaPerda: ciclos.reduce((s, c) => s + n(c.perdaEvasaoReais), 0),
            retidas: retidas.length,
            valorRetidas: retidas.reduce((s, c) => s + n(c.valorReais), 0),
          }
        : null,
    turma: regular
      ? { curso: regular.curso, alunos: n(regular.qtdAlunosMatriz), valor: n(regular.valorReais), peso: n(regular.pesoCursoMatriz), chMatriz: regular.chMatriz!, valorMatricula: n(regular.valorAluno) }
      : null,
    outroCampus,
    ultimaTurma: ultima ? { curso: ultima.curso, termino: ultima.termino!.toISOString() } : null,
    ciclosDaQuartaFase: ciclosQuarta[0]?._count._all ?? null,
    ifsul: indicadores ? { eficiencia: indicadores.ieaEficiencia === null ? null : n(indicadores.ieaEficiencia), rap: indicadores.rapPresencial === null ? null : n(indicadores.rapPresencial) } : null,
    arquivosImportados: arquivos > 0 ? arquivos : null,
    loa: loa ? { exercicio: loa.exercicio, valor: n(loa.valor) } : null,
    pnp: matriculasPnp > 0 ? { anoBase, matriculas: matriculasPnp } : null,
    pnpOrcamento: empenhado > 0 ? { anoBase, empenhado, acao: "20RL" } : null,
    confianca: { conferidos: quantos("CONFERIDO"), atencao: quantos("ATENCAO"), estimados: quantos("ESTIMADO") },
    usuarios,
    registrosDeAuditoria: auditoria,
  };
}
