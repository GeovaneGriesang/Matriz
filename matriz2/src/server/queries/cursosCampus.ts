import { prisma } from "@/server/db/prisma";
import type { CursoLinha } from "@/app/consulta/ConsultaTabelaCursos";

/**
 * Cursos de um câmpus num ano, ordenados por valor recebido (desc). `TabelaOrdenavel`
 * é client-side, então os campos `Decimal` do Prisma (instâncias de classe, não dado
 * simples) já saem como `number` daqui, antes de atravessar a fronteira de Server
 * para Client Component. Usado por `/consulta` (um câmpus por vez) e por
 * `/consulta/comparar` (vários câmpus, um de cada vez).
 */
export async function carregarCursosDoCampus(ano: number, unidadeId: number): Promise<CursoLinha[]> {
  const cursosBrutos = await prisma.distribuicaoCiclo.findMany({
    where: { ano, unidadeId },
    orderBy: { valorReais: "desc" },
    select: {
      id: true, curso: true, nivel: true, tipoCurso: true, turno: true, repasse: true,
      matriculaTotal: true, valorReais: true, perdaEvasaoReais: true, pesoCursoMatriz: true,
      inicio: true, termino: true, chMinimaMec: true, chMatriz: true, qtdAlunosMatriz: true,
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
  }));
}
