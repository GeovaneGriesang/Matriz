import type { RapInput } from "../../types/qualidadeEficiencia.types";
import { weightRegimeTrabalho } from "./weightRegimeTrabalho";

export interface RazaoDocenteAlunoResult {
  campusId: number;
  docentesEquivalentes: number;
  razaoDocenteAluno: number;
}

/**
 * Calcula a relação presencial docente/aluno, ponderando os docentes pelo
 * regime de trabalho antes de dividir pelo total de alunos presenciais.
 */
export function calcularRazaoDocenteAluno(input: RapInput): RazaoDocenteAlunoResult {
  const docentesEquivalentes = input.docentes.reduce(
    (total, docente) => total + docente.quantidade * weightRegimeTrabalho(docente.regime),
    0,
  );

  const razaoDocenteAluno =
    input.alunosPresenciais === 0 ? 0 : docentesEquivalentes / input.alunosPresenciais;

  return {
    campusId: input.campusId,
    docentesEquivalentes,
    razaoDocenteAluno,
  };
}
