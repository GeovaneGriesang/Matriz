import { describe, expect, it } from "vitest";
import { calcularRotina, ROTINA_PADRAO } from "@/lib/mdo/rotinaCurso";

describe("rotina de uma turma de técnico integrado", () => {
  it("3.200 h em 3 anos, 5 períodos de 45 min, sem contar o intervalo: 1 turno e mais de dois contraturnos por semana", () => {
    const r = calcularRotina(3200, 3, ROTINA_PADRAO);
    expect(r.horasPorAno).toBeCloseTo(1066.67, 1);
    expect(r.horasPorDia).toBeCloseTo(5.333, 3);
    expect(r.horasPorTurno).toBeCloseTo(3.75, 5);
    expect(r.periodosPorDia).toBeCloseTo(7.11, 2);
    expect(r.contraturnosPorSemana).toBeCloseTo(2.11, 2);
  });

  it("contando os 15 min de intervalo (Venâncio Aires), 800 h por ano cabem exatamente em um turno", () => {
    const r = calcularRotina(3200, 4, { ...ROTINA_PADRAO, contarIntervalo: true });
    expect(r.horasPorTurno).toBe(4);
    expect(r.turnosPorDia).toBeCloseTo(1, 10);
    expect(r.contraturnosPorSemana).toBeCloseTo(0, 10);
  });

  it("com todas as turmas em andamento, 3 e 4 anos ocupam as mesmas salas e os mesmos professores", () => {
    const tres = calcularRotina(3200, 3, ROTINA_PADRAO);
    const quatro = calcularRotina(3200, 4, ROTINA_PADRAO);
    expect(tres.periodosDeSalaPorSemana).toBeCloseTo(quatro.periodosDeSalaPorSemana, 6);
    expect(tres.periodosDeProfessorPorAno).toBeCloseTo(quatro.periodosDeProfessorPorAno, 6);
    expect(tres.turmasAoMesmoTempo).toBe(3);
  });

  it("a parte EAD sai da sala e do turno", () => {
    const r = calcularRotina(3200, 4, { ...ROTINA_PADRAO, fracaoEad: 0.2 });
    expect(r.horasPresenciaisPorAno).toBeCloseTo(640, 6);
    expect(r.horasPorDia).toBeCloseTo(3.2, 6);
  });
});
