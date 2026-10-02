import { prisma } from "@/server/db/prisma";
import type { CursoLinha } from "@/app/consulta/ConsultaTabelaCursos";
import {
  condicaoDaFormaDeEnsino,
  condicaoDaModalidade,
  formaDeEnsinoDoCurso,
  modalidadeDoCurso,
  rotuloDaModalidade,
  tipoDeCursoLegivel,
  type ChaveModalidade,
  type FormaDeEnsino,
} from "@/lib/modalidadeCurso";

/** O recorte opcional dos cursos: uma modalidade (técnico integrado, Proeja, superior...) e/ou a forma de ensino. */
export interface FiltroDeCursos {
  modalidade?: ChaveModalidade;
  ensino?: FormaDeEnsino;
}

function condicaoDoFiltro(filtro: FiltroDeCursos | undefined): Record<string, unknown>[] {
  const condicoes: Record<string, unknown>[] = [];
  if (filtro?.modalidade) condicoes.push(condicaoDaModalidade(filtro.modalidade));
  if (filtro?.ensino) condicoes.push(condicaoDaFormaDeEnsino(filtro.ensino));
  return condicoes;
}

/**
 * Cursos de um câmpus num ano, ordenados por valor recebido (desc). `TabelaOrdenavel`
 * é client-side, então os campos `Decimal` do Prisma (instâncias de classe, não dado
 * simples) já saem como `number` daqui, antes de atravessar a fronteira de Server
 * para Client Component. Usado por `/consulta` (um câmpus por vez) e por
 * `/consulta/comparar` (vários câmpus, um de cada vez).
 */
export async function carregarCursosDoCampus(ano: number, unidadeId: number, filtro?: FiltroDeCursos): Promise<CursoLinha[]> {
  const cursosBrutos = await prisma.distribuicaoCiclo.findMany({
    where: { ano, unidadeId, AND: condicaoDoFiltro(filtro) },
    orderBy: { valorReais: "desc" },
    select: {
      id: true, curso: true, nivel: true, tipoCurso: true, turno: true, repasse: true,
      matriculaTotal: true, valorReais: true, perdaEvasaoReais: true, pesoCursoMatriz: true,
      inicio: true, termino: true, chMinimaMec: true, chMatriz: true, qtdAlunosMatriz: true,
      tipoOferta: true, modalidade: true,
    },
  });
  return cursosBrutos.map((c) => ({
    id: c.id,
    curso: c.curso,
    nivel: c.nivel,
    repasse: c.repasse,
    peso: c.pesoCursoMatriz ? Number(c.pesoCursoMatriz) : null,
    matricula: Number(c.matriculaTotal),
    valor: Number(c.valorReais),
    perda: Number(c.perdaEvasaoReais ?? 0),
    inicio: c.inicio ? c.inicio.toISOString() : null,
    termino: c.termino ? c.termino.toISOString() : null,
    chMinimaMec: c.chMinimaMec ?? null,
    chMatriz: c.chMatriz ?? null,
    alunos: c.qtdAlunosMatriz ? Number(c.qtdAlunosMatriz) : null,
    modalidade: modalidadeDoCurso(c.tipoCurso, c.tipoOferta),
    modalidadeRotulo: rotuloDaModalidade(modalidadeDoCurso(c.tipoCurso, c.tipoOferta)),
    tipoCursoLegivel: tipoDeCursoLegivel(c.tipoCurso),
    ensino: formaDeEnsinoDoCurso(c.modalidade),
  }));
}

/** Os câmpus que têm pelo menos um curso no recorte (modalidade e/ou forma de ensino): são os que vale oferecer nas opções. */
export async function carregarCampiComFiltro(ano: number, filtro: FiltroDeCursos): Promise<Set<number>> {
  const linhas = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ano, AND: condicaoDoFiltro(filtro) },
  });
  return new Set(linhas.map((l) => l.unidadeId));
}

/**
 * Câmpus que têm pelo menos um curso parecido com o principal, para a comparação entre câmpus mostrar só instituições e
 * câmpus que servem: o mesmo curso (mesmo nome) ou cursos de mesmo peso. A comparação de texto do MySQL ignora maiúsculas
 * e acento.
 */
export async function carregarCampiComCursosAfins(
  ano: number,
  principal: { curso: string; peso: number | null },
  modo: "curso" | "peso",
  filtro?: FiltroDeCursos,
): Promise<Set<number>> {
  if (modo === "peso" && principal.peso === null) return new Set();
  const linhas = await prisma.distribuicaoCiclo.groupBy({
    by: ["unidadeId"],
    where: { ...(modo === "curso" ? { ano, curso: principal.curso } : { ano, pesoCursoMatriz: principal.peso! }), AND: condicaoDoFiltro(filtro) },
  });
  return new Set(linhas.map((l) => l.unidadeId));
}
