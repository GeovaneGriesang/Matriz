import { describe, expect, it } from "vitest";
import { decomporVariacoes, motivoDaTurma, somaDecomposicao, type TurmaNoTempo } from "@/lib/mdo/porQueMuda";

// Horizonte de 4 anos-base: 2025 (hoje), 2026, 2027, 2028.
const turmas: TurmaNoTempo[] = [
  // Turma de hoje que termina em 2025: forma em 2026, e o retido sai em 2027.
  { curso: "A", origem: "hoje", anoTermino: 2025, valores: [100, 20, 0, 0] },
  // Turma de hoje em andamento até 2027: evasão.
  { curso: "A", origem: "hoje", anoTermino: 2027, valores: [80, 70, 60, 10] },
  // Reposição que entra em 2026 no meio do ano: entra, e em 2027 conta o ano inteiro.
  { curso: "A", origem: "reposicao", anoTermino: 2028, valores: [0, 40, 90, 85] },
  // Curso novo em 2027 e reformulado em 2028.
  { curso: "B", origem: "novo", anoTermino: 2030, valores: [0, 0, 50, 48] },
  { curso: "C", origem: "reformulado", anoTermino: 2031, valores: [0, 0, 0, 30] },
];

describe("motivoDaTurma", () => {
  it("separa formatura, retidos, evasão, ano completo e entradas", () => {
    expect(motivoDaTurma(turmas[0]!, 1, 2026)).toBe("formaram");
    expect(motivoDaTurma(turmas[0]!, 2, 2027)).toBe("retidos");
    expect(motivoDaTurma(turmas[1]!, 1, 2026)).toBe("evasao");
    expect(motivoDaTurma(turmas[2]!, 1, 2026)).toBe("reposicao");
    expect(motivoDaTurma(turmas[2]!, 2, 2027)).toBe("anoCompleto");
    expect(motivoDaTurma(turmas[3]!, 2, 2027)).toBe("novos");
    expect(motivoDaTurma(turmas[4]!, 3, 2028)).toBe("reformulados");
    expect(motivoDaTurma(turmas[1]!, 3, 2028)).toBe("formaram");
  });
});

describe("decomporVariacoes", () => {
  it("a soma das causas é a variação do total, ano a ano, com o MOOC", () => {
    const mooc = [0, 5, 5, 12];
    const v = decomporVariacoes(turmas, 4, 2025, mooc);
    expect(v).toHaveLength(3);
    for (const a of v) expect(somaDecomposicao(a.porMotivo)).toBeCloseTo(a.depois - a.antes, 9);
    expect(v[0]!.porMotivo.formaram).toBe(-80);
    expect(v[0]!.porMotivo.reposicao).toBe(40);
    expect(v[0]!.porMotivo.mooc).toBe(5);
    expect(v[2]!.porMotivo.mooc).toBe(7);
    expect(v[1]!.porCurso.get("B")!.novos).toBe(50);
  });
});
