/**
 * Como o sistema escreve qual é a turma quando o mesmo curso aparece mais de uma vez (pedido do usuário em 2026-11-04: "precisamos saber o ciclo daquele
 * curso, sempre, em todos os lugares"). O código do ciclo é o da MDO, o mesmo em todos os anos; o período é o que quem lê reconhece.
 */

export interface CicloIdentificavel {
  codigoCiclo?: string | null;
  inicio: string | Date | null;
  termino: string | Date | null;
}

// As datas do ciclo são dias do calendário à meia-noite UTC: no fuso do Brasil apareceriam como o dia (e às vezes o mês) anterior.
function mesEAno(valor: string | Date | null): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** "03/2025 a 12/2028". */
export function periodoCurtoDoCiclo(c: Pick<CicloIdentificavel, "inicio" | "termino">): string {
  const inicio = mesEAno(c.inicio);
  const termino = mesEAno(c.termino);
  if (inicio && termino) return `${inicio} a ${termino}`;
  if (inicio) return `início em ${inicio}`;
  return "sem data";
}

/** "ciclo 2986225, 03/2025 a 12/2028". */
export function rotuloDoCiclo(c: CicloIdentificavel): string {
  return `${c.codigoCiclo ? `ciclo ${c.codigoCiclo}, ` : ""}${periodoCurtoDoCiclo(c)}`;
}
