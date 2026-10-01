/**
 * Regras que ligam o microdado da PNP à Matrícula Total da MDO, decifradas em 2026-09-30 comparando os microdados de
 * matrículas de 2025 com a 6ª fase de 2027 (58.242 ciclos). Cada regra diz, no comentário, em quantos ciclos foi
 * conferida. Ver `docs/calculo-da-matriz-a-partir-da-pnp.md`.
 *
 * Funções puras: nada aqui lê banco ou arquivo.
 */

const MS_DIA = 86_400_000;

/** O tipo de curso na PNP vem sem acento e em caixa alta na MDO ("QUALIFICACAO PROFISSIONAL (FIC)"). */
export function ehQualificacaoProfissional(tipoCurso: string): boolean {
  return tipoCurso.toUpperCase().startsWith("QUALIFICA");
}

/**
 * Prazo de jubilamento, em dias depois do término do ciclo: 1.095 (3 anos) em todos os tipos de curso e ZERO na
 * Qualificação Profissional (FIC). Confere em 58.242 de 58.242 ciclos.
 */
export function prazoDeJubilamentoEmDias(tipoCurso: string): number {
  return ehQualificacaoProfissional(tipoCurso) ? 0 : 1095;
}

export function dataDeJubilamento(termino: Date, tipoCurso: string): Date {
  return new Date(termino.getTime() + prazoDeJubilamentoEmDias(tipoCurso) * MS_DIA);
}

/**
 * Quantidade de alunos que a MDO conta num ciclo ("Qtd. Alunos"): as matrículas do ciclo na PNP, se ele não está
 * jubilado no início do período; senão, zero. Dos 58.242 ciclos, 50.575 têm aluno e todos batem com a PNP; dos 7.667
 * zerados, 7.664 estão jubilados.
 */
export function alunosContadosPelaMdo(matriculas: number, jubilamento: Date, inicioDoPeriodo: Date): number {
  return jubilamento.getTime() < inicioDoPeriodo.getTime() ? 0 : matriculas;
}

/**
 * Carga horária da matriz (CHM): FIC e doutorado usam a do ciclo; Proeja, 2.400 h; integrado, 3.000, 3.100 ou 3.200 h
 * conforme a mínima do MEC (800, 1.000 ou 1.200 h); os demais usam a própria mínima do MEC. Confere em 58.242 de
 * 58.242 ciclos, dada a carga horária mínima que a MDO usou.
 */
export function chMatrizPorRegra(tipoCurso: string, tipoOferta: string, chCiclo: number, chMinimaMec: number): number {
  const tipo = tipoCurso.toUpperCase();
  const oferta = tipoOferta.toUpperCase();
  if (ehQualificacaoProfissional(tipo) || tipo === "DOUTORADO") return chCiclo;
  if (oferta.includes("PROEJA")) return 2400;
  if (oferta === "INTEGRADO") {
    if (chMinimaMec === 800) return 3000;
    if (chMinimaMec === 1000) return 3100;
    if (chMinimaMec === 1200) return 3200;
  }
  return chMinimaMec;
}

/**
 * Curso FIC que a MDO não achou no catálogo recebe uma carga horária mínima "padrão" de 3.200 h e, junto, o peso 2,5.
 * Nos 3.129 ciclos do FIC com mínima de 3.200 h o peso aplicado foi 2,5, mesmo que a coluna de peso da exportação
 * antiga da rede dissesse 1 (era assim em 1.488 deles). Fora dessa condição o FIC vale o peso da coluna.
 */
export const CH_MINIMA_FIC_SEM_CATALOGO = 3200;
export const PESO_FIC_SEM_CATALOGO = 2.5;

export function pesoEfetivoDoFic(chMinimaMec: number): number | null {
  return chMinimaMec === CH_MINIMA_FIC_SEM_CATALOGO ? PESO_FIC_SEM_CATALOGO : null;
}

/**
 * O PESO EFETIVO (o que a MDO aplicou, já com o bônus de agropecuária) é função de (tipo de curso, tipo de oferta,
 * nome do curso, carga horária mínima do MEC): 99,77% dos 49.391 ciclos conferidos (115 erros). Sem a carga horária
 * mínima na chave a conta cai para 93,5%, e a coluna de peso da exportação antiga erra em cerca de 3% dos ciclos
 * (FIC com mínima de 3.200 h, algumas especializações e mestrados, ensino fundamental e alguns bacharelados). Por isso
 * a tabela de pesos do sistema deve ser indexada por esta chave, e não pela coluna de peso.
 */
export function chaveDoPesoEfetivo(tipoCurso: string, tipoOferta: string, curso: string, chMinimaMec: number): string {
  return `${tipoCurso}|${tipoOferta}|${curso}|${chMinimaMec}`;
}
