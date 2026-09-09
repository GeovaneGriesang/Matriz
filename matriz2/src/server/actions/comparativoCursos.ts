"use server";

import { getAdminSession } from "@/server/auth/session";
import { carregarCursosDoCampus } from "@/server/queries/cursosCampus";
import type { CursoLinha } from "@/app/consulta/ConsultaTabelaCursos";

export interface CursosComparativoCampus {
  ok: boolean;
  errorMessage?: string;
  cursosA: CursoLinha[];
  cursosB: CursoLinha[];
}

/**
 * Busca sob demanda os cursos de um câmpus nos dois ciclos do Comparativo, para o
 * segundo nível do "+/-" (expandir um câmpus mostra os cursos dele). Não precarrega
 * isso para a rede inteira na página: são até centenas de câmpus, e a imensa
 * maioria nunca chega a ser expandida.
 */
export async function carregarCursosComparativoCampusAction(
  unidadeId: number,
  anoA: number,
  anoB: number,
): Promise<CursosComparativoCampus> {
  const usuario = await getAdminSession();
  if (!usuario || usuario.papel === "PADRAO") {
    return { ok: false, errorMessage: "Não autorizado.", cursosA: [], cursosB: [] };
  }
  const [cursosA, cursosB] = await Promise.all([
    carregarCursosDoCampus(anoA, unidadeId),
    carregarCursosDoCampus(anoB, unidadeId),
  ]);
  return { ok: true, cursosA, cursosB };
}
