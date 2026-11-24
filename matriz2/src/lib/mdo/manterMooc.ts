/**
 * Manter a matrícula MOOC num número fixo, na tela de Cenários.
 *
 * Os cursos MOOC duram semanas e abrem e fecham turmas o ano todo, então repetir as turmas de hoje (como a projeção faz com os
 * outros cursos) dá uma curva que depende de quando cada turma caiu no ano-base. Quem planeja costuma pensar num número de alunos
 * MOOC por ano. Com a opção ligada, cada ano depois do de hoje passa a ter esse número de alunos MOOC, e cada um vale o mesmo que um
 * aluno MOOC vale hoje no câmpus (em reais, em alunos contados e em matrícula equivalente). O primeiro ano fica como foi publicado.
 *
 * A diferença entre esse alvo e o que a projeção daria entra na coluna Reposição, e também em "manter tudo", porque é uma
 * premissa da projeção e não uma mudança do cenário.
 */

export interface MoocDoAno {
  /** Já matriculados nas turmas MOOC, na medida da tabela. */
  matric: number;
  /** Reposição das turmas MOOC que conta no cenário. */
  repos: number;
  /** Reposição das turmas MOOC se nada mudasse. */
  reposTudo: number;
  /** Alunos que a MDO conta (matriculados e reposição do cenário). */
  contados: number;
}

export interface MoocDeHoje {
  /** Alunos MOOC matriculados no ano de hoje (cada um vale 1). */
  alunos: number;
  /** O mesmo grupo na medida da tabela. */
  medida: number;
  /** O mesmo grupo em alunos que a MDO conta. */
  contados: number;
}

export interface AjusteMooc {
  repos: number;
  reposTudo: number;
  contados: number;
}

/** Quanto somar, em cada ano, para que o MOOC do câmpus tenha `alvoAlunos` alunos. O ano 0 nunca muda. */
export function ajusteParaManterMooc(anos: MoocDoAno[], hoje: MoocDeHoje, alvoAlunos: number): AjusteMooc[] {
  const porAluno = hoje.alunos > 0 ? hoje.medida / hoje.alunos : 0;
  const contadosPorAluno = hoje.alunos > 0 ? hoje.contados / hoje.alunos : 0;
  const alvo = Math.max(0, alvoAlunos);
  return anos.map((a, k) => {
    if (k === 0 || hoje.alunos <= 0) return { repos: 0, reposTudo: 0, contados: 0 };
    const alvoMedida = alvo * porAluno;
    const alvoContados = alvo * contadosPorAluno;
    return {
      repos: alvoMedida - (a.matric + a.repos),
      reposTudo: alvoMedida - (a.matric + a.reposTudo),
      contados: alvoContados - a.contados,
    };
  });
}

/** Reparte um número de alunos MOOC da instituição entre os câmpus, na proporção dos alunos MOOC de hoje. */
export function repartirMooc(total: number, hojePorCampus: Map<number, number>): Record<string, number> {
  const soma = [...hojePorCampus.values()].reduce((s, v) => s + v, 0);
  const r: Record<string, number> = {};
  if (soma <= 0) return r;
  for (const [id, v] of hojePorCampus) if (v > 0) r[String(id)] = (Math.max(0, total) * v) / soma;
  return r;
}
