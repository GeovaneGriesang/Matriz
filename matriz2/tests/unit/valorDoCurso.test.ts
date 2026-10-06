import { describe, expect, it } from "vitest";
import { chDaMatrizDoCurso, valorDoCurso } from "@/lib/mdo/valorDoCurso";
import { matriculaTotalDoCiclo } from "@/lib/mdo/matriculaTotal";

describe("chDaMatrizDoCurso", () => {
  it("integrado usa 3.000, 3.100 ou 3.200 h conforme a mínima do MEC", () => {
    expect(chDaMatrizDoCurso("TECNICO", "INTEGRADO", 800)).toBe(3000);
    expect(chDaMatrizDoCurso("TECNICO", "INTEGRADO", 1000)).toBe(3100);
    expect(chDaMatrizDoCurso("TECNICO", "INTEGRADO", 1200)).toBe(3200);
  });
  it("Proeja usa 2.400 h e os demais cursos a própria mínima do MEC", () => {
    expect(chDaMatrizDoCurso("TECNICO", "INTEGRADO PROEJA", 1200)).toBe(2400);
    expect(chDaMatrizDoCurso("TECNICO", "SUBSEQUENTE", 1200)).toBe(1200);
    expect(chDaMatrizDoCurso("LICENCIATURA", "NÃO SE APLICA", 3200)).toBe(3200);
  });
  it("FIC usa a carga horária do ciclo (aqui, a mínima informada)", () => {
    expect(chDaMatrizDoCurso("QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA", 160)).toBe(160);
  });
});

describe("valorDoCurso", () => {
  it("peso x CH da matriz / 800 x valor da matrícula", () => {
    const v = valorDoCurso({ tipoCurso: "TECNICO", tipoOferta: "SUBSEQUENTE", chMinimaMec: 1200, pesoEfetivo: 1.5, valorMatriculaPresencial: 1000 });
    expect(v.chMatriz).toBe(1200);
    expect(v.matriculasEquivalentesPorAluno).toBeCloseTo(1.5 * 1.5, 9);
    expect(v.valorPorAlunoNoCurso).toBeCloseTo(2250, 6);
    expect(v.valorPorAlunoPorAno).toBeNull();
  });

  it("dividido pelos anos do curso dá o valor por ano", () => {
    const v = valorDoCurso({ tipoCurso: "TECNOLOGIA", tipoOferta: "NÃO SE APLICA", chMinimaMec: 2400, pesoEfetivo: 2, valorMatriculaPresencial: 1000, anosDeCurso: 3 });
    expect(v.valorPorAlunoNoCurso).toBeCloseTo(2 * 3 * 1000, 6);
    expect(v.valorPorAlunoPorAno).toBeCloseTo(2000, 6);
  });

  it("a distância vale uma fração do presencial", () => {
    const base = { tipoCurso: "TECNOLOGIA", tipoOferta: "NÃO SE APLICA", chMinimaMec: 2400, pesoEfetivo: 2, valorMatriculaPresencial: 1000 };
    const presencial = valorDoCurso(base).valorPorAlunoNoCurso;
    expect(valorDoCurso({ ...base, repasse: "EAD" }).valorPorAlunoNoCurso).toBeCloseTo(presencial * 0.25, 6);
    expect(valorDoCurso({ ...base, repasse: "EAD_MOOC" }).valorPorAlunoNoCurso).toBeCloseTo(presencial * 0.08, 6);
  });

  it("confere com o motor da Matrícula Total: somados os anos do curso, um aluno rende peso x CH / 800", () => {
    // Curso de 3 anos, 3.000 h, peso 1,5, 1 aluno, sem evasão: soma da Matrícula Total em cada ano-base.
    const inicio = new Date(Date.UTC(2023, 0, 1));
    const termino = new Date(Date.UTC(2025, 11, 31));
    const ciclo = { inicio, termino, jubilamento: new Date(Date.UTC(2028, 11, 31)), chCiclo: 3000, chMec: 3000, chMatriz: 3000, peso: 1.5, agropecuaria: false, alunos: 1 };
    let soma = 0;
    for (const ano of [2023, 2024, 2025]) soma += matriculaTotalDoCiclo(ciclo, { inicio: new Date(Date.UTC(ano, 0, 1)), fim: new Date(Date.UTC(ano, 11, 31)) });
    const v = valorDoCurso({ tipoCurso: "TECNICO", tipoOferta: "INTEGRADO", chMinimaMec: 800, pesoEfetivo: 1.5, valorMatriculaPresencial: 1 });
    expect(v.chMatriz).toBe(3000);
    expect(soma).toBeCloseTo(v.matriculasEquivalentesPorAluno, 1);
  });
});
