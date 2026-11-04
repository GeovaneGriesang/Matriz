/**
 * Turmas que terminaram antes do ano-base e ainda rendem, por causa dos alunos retidos. A matriz de 2027 usa o ano-base 2025: uma turma que
 * terminou em 2024 não tem início, meio nem fim em 2025, mas os alunos que seguem matriculados contam pela metade (ICQA 0,50) e por meio ano, até o
 * prazo de jubilamento. Ficam num grupo à parte nas telas, e não fora delas, porque o valor delas faz parte do que a MDO paga: sem elas, a soma dos
 * cursos não fecharia com a matriz (decisão em 2026-11-04).
 */

export const NOME_DAS_TURMAS_RETIDAS = "Turmas já encerradas, com alunos retidos";

/** O ano da PNP que a matriz usa: dois anos antes do ciclo. */
export function anoBaseDoCiclo(ano: number): number {
  return ano - 2;
}

/** A turma terminou antes de começar o ano-base do ciclo. Sem data de término, não dá para afirmar: fica com as demais. */
export function turmaEncerradaAntesDoAnoBase(termino: string | Date | null | undefined, ano: number): boolean {
  if (!termino) return false;
  return new Date(termino).getTime() < Date.UTC(anoBaseDoCiclo(ano), 0, 1);
}

/** A explicação que acompanha o grupo em todas as telas. */
export function explicacaoDasTurmasRetidas(ano: number): string {
  const base = anoBaseDoCiclo(ano);
  return `Terminaram antes de ${base}, o ano-base da matriz de ${ano}, mas ainda têm alunos matriculados. Esses alunos contam pela metade (ICQA 0,50) e por meio ano, até o prazo de jubilamento. O valor faz parte do que a MDO paga e entra nos totais. Essa parcela tende a acabar quando eles concluem o curso ou passam do prazo.`;
}
