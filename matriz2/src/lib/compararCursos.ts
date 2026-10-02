/**
 * Regras da comparação de cursos entre câmpus (`/consulta/comparar`): o primeiro curso escolhido é o PRINCIPAL, os outros
 * são comparados a ele, e a seleção dos outros pode ser limitada a cursos iguais ou de mesmo peso. Funções puras.
 */

export type ModoFiltro = "todos" | "curso" | "peso";

export function modoDoParametro(valor: string | undefined): ModoFiltro {
  return valor === "curso" || valor === "peso" ? valor : "todos";
}

interface ComNome {
  curso: string;
}
interface ComPeso {
  peso: number | null;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** Mesmo curso: o mesmo nome, sem diferenciar maiúsculas nem acento. */
export function mesmoCurso(a: ComNome, b: ComNome): boolean {
  return normalizar(a.curso) === normalizar(b.curso);
}

/** Mesmo peso na matriz. Curso sem peso informado nunca é "de mesmo peso". */
export function mesmoPeso(a: ComPeso, b: ComPeso): boolean {
  return a.peso !== null && b.peso !== null && Math.abs(a.peso - b.peso) < 1e-6;
}

/** O candidato pode aparecer nas opções, dado o filtro escolhido e o curso principal? */
export function passaNoFiltro(modo: ModoFiltro, principal: ComNome & ComPeso, candidato: ComNome & ComPeso): boolean {
  if (modo === "curso") return mesmoCurso(principal, candidato);
  if (modo === "peso") return mesmoPeso(principal, candidato);
  return true;
}

export interface Diferenca {
  /** Principal menos o outro, na unidade da medida. */
  absoluta: number;
  /** Diferença sobre o valor do outro (0,1 = o principal tem 10% a mais); null quando o outro é zero. */
  percentual: number | null;
}

export function diferencaParaPrincipal(principal: number | null, outro: number | null): Diferenca | null {
  if (principal === null || outro === null) return null;
  const absoluta = principal - outro;
  return { absoluta, percentual: outro !== 0 ? absoluta / Math.abs(outro) : null };
}

export interface CursoParaDiferenca {
  valor: number;
  matricula: number;
  alunos: number | null;
  perda: number;
  peso: number | null;
  chMatriz: number | null;
}

export interface DiferencasContraOutro {
  valor: Diferenca | null;
  valorPorAluno: Diferenca | null;
  matricula: Diferenca | null;
  perda: Diferenca | null;
  peso: Diferenca | null;
  alunos: Diferenca | null;
  chMatriz: Diferenca | null;
}

/** O que o principal ganha (diferença positiva) ou perde (negativa) em relação a outro curso, medida a medida. */
export function diferencasContra(principal: CursoParaDiferenca, outro: CursoParaDiferenca): DiferencasContraOutro {
  const porAluno = (c: CursoParaDiferenca) => (c.alunos ? c.valor / c.alunos : null);
  return {
    valor: diferencaParaPrincipal(principal.valor, outro.valor),
    valorPorAluno: diferencaParaPrincipal(porAluno(principal), porAluno(outro)),
    matricula: diferencaParaPrincipal(principal.matricula, outro.matricula),
    perda: diferencaParaPrincipal(principal.perda, outro.perda),
    peso: diferencaParaPrincipal(principal.peso, outro.peso),
    alunos: diferencaParaPrincipal(principal.alunos, outro.alunos),
    chMatriz: diferencaParaPrincipal(principal.chMatriz, outro.chMatriz),
  };
}
