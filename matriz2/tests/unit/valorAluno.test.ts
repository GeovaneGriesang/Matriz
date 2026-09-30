import { describe, expect, it } from "vitest";
import { analisarCiclo, periodoDoCiclo, type CicloArmazenado } from "@/lib/mdo/valorAluno";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const periodo = periodoDoCiclo(2027);

function ciclo(sobrescreve: Partial<CicloArmazenado> = {}): CicloArmazenado {
  return {
    inicio: dia("2024-02-19"),
    termino: dia("2027-12-22"),
    jubilamento: dia("2030-12-21"),
    chMinimaMec: 1200,
    cargaHoraria: 3750,
    chMatriz: 3200,
    peso: 1.5,
    alunos: 63,
    matriculaTotal: 98.339,
    valorReais: 98.339 * 1228.895,
    valorMatricula: 1228.895,
    agropecuaria: false,
    ...sobrescreve,
  };
}

describe("valor de um aluno", () => {
  it("o período do ciclo 2027 é a PNP de 2025", () => {
    expect(periodo.inicio.toISOString().slice(0, 10)).toBe("2025-01-01");
    expect(periodo.fim.toISOString().slice(0, 10)).toBe("2025-12-31");
  });

  it("refaz a Matrícula Total publicada de um técnico integrado do IFSul", () => {
    const a = analisarCiclo(ciclo(), periodo)!;
    expect(a.decomposicao.matriculaTotal).toBeCloseTo(98.339, 3);
    expect(a.divergenciaMotor).toBeLessThan(0.001);
  });

  it("um aluno em ano cheio vale peso x CH/800 x valor da matrícula, por ano do curso", () => {
    const a = analisarCiclo(ciclo(), periodo)!;
    // 3.200 h em 1.403 dias: 3.200 x 365 / 1.403 = 832,5 h por ano; / 800 = 1,0406; x 1,5 x 1.228,895.
    expect(a.valorAnoCheioPorAluno).toBeCloseTo(1.5 * (3200 / 800) * (365 / 1403) * 1228.895, 2);
  });

  it("o valor efetivo é o valor do ciclo dividido pelos alunos", () => {
    const c = ciclo();
    expect(analisarCiclo(c, periodo)!.valorEfetivoPorAluno).toBeCloseTo(c.valorReais / 63, 6);
  });

  it("deduz agropecuária quando a exportação antiga não traz a coluna", () => {
    const sem = analisarCiclo(ciclo(), periodo)!.decomposicao.matriculaTotal;
    const a = analisarCiclo(ciclo({ agropecuaria: null, matriculaTotal: sem * 1.5, valorReais: sem * 1.5 * 1228.895 }), periodo)!;
    expect(a.agropecuariaInferida).toBe(true);
    expect(a.decomposicao.bonusAgropecuaria).toBe(1.5);
    const b = analisarCiclo(ciclo({ agropecuaria: null, matriculaTotal: sem }), periodo)!;
    expect(b.agropecuariaInferida).toBe(false);
  });

  it("sem datas ou sem alunos, não há o que analisar", () => {
    expect(analisarCiclo(ciclo({ inicio: null }), periodo)).toBeNull();
    expect(analisarCiclo(ciclo({ alunos: 0 }), periodo)).toBeNull();
  });
});
