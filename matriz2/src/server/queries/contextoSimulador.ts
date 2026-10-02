import { prisma } from "@/server/db/prisma";
import { padroesDoCurso, type PadroesDoCurso } from "@/lib/mdo/padroesCurso";
import type { IndicadoresDaInstituicao } from "@/lib/simulacaoIndicadores";
import { calcularQualidadeEficienciaRede } from "@/server/queries/qualidadeEficienciaRede";
import { campusEstaNoPiso, carregarTaxasFuncionamento } from "@/server/queries/funcionamentoCampus";

/**
 * O que os simuladores de "e se" precisam saber de um câmpus: quanto vale uma matrícula, quanto ele recebe e perde hoje,
 * se está travado no Piso Mínimo e o tamanho da rede (para a diluição do valor). Fonte única de `/simulador/novo-curso`
 * e `/simulador/alternativas`.
 */

export interface ContextoDoCampus {
  valorMatricula: number;
  orcamentoCampusHoje: number;
  perdaCampus: number;
  alunosCampus: number;
  noPiso: boolean;
  matriculasRede: number;
}

function moda<T>(valores: T[]): T | undefined {
  const cont = new Map<T, number>();
  for (const v of valores) cont.set(v, (cont.get(v) ?? 0) + 1);
  return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export async function carregarContextoDoCampus(ano: number, instituicaoId: number, unidadeId: number): Promise<ContextoDoCampus> {
  const [ciclos, taxas, distCampus, parametros] = await Promise.all([
    prisma.distribuicaoCiclo.findMany({
      where: { ano, unidadeId },
      select: { valorAluno: true, valorReais: true, perdaEvasaoReais: true, qtdAlunosMatriz: true, repasse: true },
    }),
    carregarTaxasFuncionamento(ano),
    prisma.distribuicaoCampus.findUnique({ where: { ano_unidadeId: { ano, unidadeId } } }),
    prisma.parametrosParticipacao.findUnique({ where: { ano_instituicaoId: { ano, instituicaoId } } }),
  ]);
  // O valor da matrícula presencial: o das outras modalidades é menor (formação profissional 0,8, EAD 0,25...) e, sendo as
  // mais numerosas em alguns câmpus, tirariam o valor errado se a moda fosse sobre todos os ciclos.
  const positivos = (lista: typeof ciclos) => lista.map((c) => Number(c.valorAluno ?? 0)).filter((v) => v > 0);
  const valorMatricula = Number(moda(positivos(ciclos.filter((c) => c.repasse === "PRESENCIAL"))) ?? moda(positivos(ciclos)) ?? 0) || 1200;
  const noPiso =
    taxas && distCampus
      ? campusEstaNoPiso(taxas, {
          mtPresencial: Number(distCampus.mtPresencial ?? 0),
          mtEad: Number(distCampus.mtEad ?? 0),
          mtEadMooc: Number(distCampus.mtEadMooc ?? 0),
          mtEadFp: Number(distCampus.mtEadFp ?? 0),
          elegivelPiso: distCampus.elegivelPiso,
        })
      : false;
  const matriculasRede = parametros
    ? Number(parametros.matriculasPresencial) +
      Number(parametros.matriculasEad) * Number(parametros.pesoEad) +
      Number(parametros.matriculasEadMooc) * Number(parametros.pesoEadMooc) +
      Number(parametros.matriculasEadFp) * Number(parametros.pesoEadFp)
    : 1_500_000;
  return {
    valorMatricula,
    orcamentoCampusHoje: ciclos.reduce((s, c) => s + Number(c.valorReais), 0),
    perdaCampus: ciclos.reduce((s, c) => s + Number(c.perdaEvasaoReais ?? 0), 0),
    alunosCampus: ciclos.reduce((s, c) => s + Number(c.qtdAlunosMatriz ?? 0), 0),
    noPiso,
    matriculasRede,
  };
}

/** RAP e IAPL de uma instituição no ciclo, já com o "resto da rede" que a simulação precisa (ver `simulacaoIndicadores.ts`). */
export async function carregarIndicadoresDaInstituicao(ano: number, sigla: string): Promise<IndicadoresDaInstituicao> {
  const rede = await calcularQualidadeEficienciaRede(ano);
  const i = rede.instituicoes.find((x) => x.sigla === sigla);
  return {
    rap: i ? { rapPresencial: i.rapPresencial, restoRedeRapPonderado: rede.somaRapPonderadoRecalc - i.rapPonderadoRecalc } : null,
    iapl: i
      ? {
          aplTecnico: i.aplTecnico,
          restoRedeTecnico: rede.somaIaplTecnicoRecalc - i.iaplTecnicoPonderadoRecalc,
          aplFormacaoProfessor: i.aplFormacaoProfessor,
          restoRedeFormacao: rede.somaIaplFormacaoRecalc - i.iaplFormacaoPonderadoRecalc,
          aplProeja: i.aplProeja,
          restoRedeProeja: rede.somaIaplProejaRecalc - i.iaplProejaPonderadoRecalc,
        }
      : null,
    totalBlocoRap: rede.totalBlocoRap,
    totalBlocoIapl: rede.totalBlocoIapl,
  };
}

export interface ItemCatalogo {
  chave: string;
  rotulo: string;
  tipoCurso: string;
  tipoOferta: string;
  peso: number;
  chMinimaMec: number;
  ciclos: number;
  padroes: PadroesDoCurso;
}

export const chaveDoCatalogo = (l: { tipoCurso: string; tipoOferta: string; curso: string; chMinimaMec: number }) =>
  `${l.tipoCurso}|${l.tipoOferta}|${l.curso}|${l.chMinimaMec}`;

/** Os cursos mais comuns da tabela de peso efetivo, com o peso, o teto de CH e os padrões de cada um, para o seletor da tela. */
export async function carregarCatalogo(limite = 320): Promise<ItemCatalogo[]> {
  const ano = (await prisma.pesoEfetivoCurso.aggregate({ _max: { anoReferencia: true } }))._max.anoReferencia;
  if (!ano) return [];
  const linhas = await prisma.pesoEfetivoCurso.findMany({
    where: { anoReferencia: ano, origem: "DEDUZIDO_DA_MATRICULA_TOTAL" },
    orderBy: { ciclosObservados: "desc" },
    take: limite,
  });
  return linhas.map((l) => ({
    chave: chaveDoCatalogo(l),
    rotulo: `${l.curso}${l.tipoOferta && l.tipoOferta !== "NÃO SE APLICA" ? ` (${l.tipoOferta.toLowerCase()})` : ""}`,
    tipoCurso: l.tipoCurso,
    tipoOferta: l.tipoOferta,
    peso: Number(l.pesoEfetivo),
    chMinimaMec: l.chMinimaMec,
    ciclos: l.ciclosObservados,
    padroes: padroesDoCurso(l.tipoCurso, l.tipoOferta, l.chMinimaMec),
  }));
}
