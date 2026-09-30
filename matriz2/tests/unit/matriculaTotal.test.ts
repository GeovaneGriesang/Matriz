import { describe, expect, it } from "vitest";
import fixture from "../fixtures/participacao_ifsul_2027_amostra.json";
import {
  chEfetiva,
  decomporMatriculaTotal,
  diasAtivosNoPeriodo,
  diasDoCiclo,
  icqaDoCiclo,
  matriculaTotalDoCiclo,
  valorDoCiclo,
  valorPorMatricula,
  type CicloParaCalculo,
  type Repasse,
} from "@/lib/mdo/matriculaTotal";

/** A planilha escreve "EAD MOOC" e "EAD FP" com espaço. */
const REPASSE: Record<string, Repasse> = { PRESENCIAL: "PRESENCIAL", EAD: "EAD", "EAD MOOC": "EAD_MOOC", "EAD FP": "EAD_FP" };

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const periodo = { inicio: dia(fixture.periodo.inicio), fim: dia(fixture.periodo.fim) };

function ciclo(sobrescreve: Partial<CicloParaCalculo> = {}): CicloParaCalculo {
  return {
    inicio: dia("2025-03-10"),
    termino: dia("2028-12-21"),
    jubilamento: dia("2031-12-21"),
    chCiclo: 3000,
    chMec: 800,
    chMatriz: 3000,
    peso: 1,
    agropecuaria: false,
    alunos: 32,
    ...sobrescreve,
  };
}

describe("regras da Matrícula Total", () => {
  it("conta os dias do ciclo incluindo início e término", () => {
    expect(diasDoCiclo({ inicio: dia("2025-11-01"), termino: dia("2025-11-30") })).toBe(30);
    // 2025-03-10 a 2028-12-21: o ano de 2028 é bissexto.
    expect(diasDoCiclo(ciclo())).toBe(1383);
  });

  it("um técnico integrado começando em março rende só os dias que caem no ano-base", () => {
    // 297 dias ativos (10/03 a 31/12) de 1.383, com 3.000 h / 800 = 3,75 por aluno.
    const d = decomporMatriculaTotal(ciclo(), periodo);
    expect(d.diasAtivos).toBe(297);
    expect(d.matriculaTotal).toBeCloseTo(32 * 3.75 * (297 / 1383), 6);
  });

  it("aluno retido dentro do prazo conta meio ano e metade do peso (ICQA 0,5)", () => {
    const retido = ciclo({ inicio: dia("2021-07-21"), termino: dia("2024-12-20"), jubilamento: dia("2027-12-20") });
    expect(icqaDoCiclo(retido, periodo)).toBe(0.5);
    expect(diasAtivosNoPeriodo(retido, periodo)).toBe(182.5);
  });

  it("aluno jubilado antes do período não conta", () => {
    const jubilado = ciclo({ inicio: dia("2018-03-01"), termino: dia("2021-12-20"), jubilamento: dia("2024-12-20") });
    expect(icqaDoCiclo(jubilado, periodo)).toBe(0);
    expect(matriculaTotalDoCiclo(jubilado, periodo)).toBe(0);
  });

  it("ciclo de mais de um ano limita a CH à menor entre a do ciclo e a da matriz", () => {
    expect(chEfetiva(ciclo({ chCiclo: 3060, chMatriz: 3200 }))).toBe(3060);
    expect(chEfetiva(ciclo({ chCiclo: 3800, chMatriz: 3200 }))).toBe(3200);
  });

  it("ciclo de até um ano usa sempre a CH da matriz", () => {
    const curto = { inicio: dia("2025-03-10"), termino: dia("2025-12-21"), chCiclo: 1520, chMatriz: 3200 };
    expect(chEfetiva(ciclo(curto))).toBe(3200);
  });

  it("agropecuária ganha 50% a mais", () => {
    const comum = matriculaTotalDoCiclo(ciclo(), periodo);
    expect(matriculaTotalDoCiclo(ciclo({ agropecuaria: true }), periodo)).toBeCloseTo(comum * 1.5, 9);
  });
});

describe("valor de uma matrícula", () => {
  const parametros = {
    ...fixture.parametros,
    matriculasTotaisRede: fixture.parametros.matriculasTotaisRede as Record<Repasse, number>,
    pesos: fixture.parametros.pesos as Record<Repasse, number>,
  };
  const valor = valorPorMatricula(parametros);

  it("reproduz os valores que o Excel calculou na aba Parâmetros", () => {
    for (const r of Object.keys(fixture.valorMatriculaEsperado) as Repasse[]) {
      expect(valor[r]).toBeCloseTo(fixture.valorMatriculaEsperado[r], 6);
    }
  });
});

describe("contra a planilha do IFSul de 2027 calculada pelo Excel", () => {
  const parametros = {
    ...fixture.parametros,
    matriculasTotaisRede: fixture.parametros.matriculasTotaisRede as Record<Repasse, number>,
    pesos: fixture.parametros.pesos as Record<Repasse, number>,
  };
  const valor = valorPorMatricula(parametros);

  it("a amostra tem linhas de todos os tipos", () => {
    expect(fixture.ciclos.length).toBeGreaterThan(40);
  });

  it.each(fixture.ciclos.map((c, i) => [i, c.curso, c] as const))(
    "linha %i (%s): Matrícula Total, valor e custo evadido batem",
    (_i, _curso, c) => {
      const entrada: CicloParaCalculo = {
        inicio: dia(c.inicio),
        termino: dia(c.termino),
        jubilamento: dia(c.jubilamento),
        chMec: c.chMec,
        chCiclo: c.chCiclo,
        chMatriz: c.chMatriz,
        peso: c.peso,
        agropecuaria: c.agropecuaria,
        alunos: c.alunos,
      };
      expect(icqaDoCiclo(entrada, periodo)).toBe(c.esperado.icqa);
      const mt = matriculaTotalDoCiclo(entrada, periodo);
      expect(mt).toBeCloseTo(c.esperado.matriculaTotal, 5);
      const v = valorDoCiclo(entrada, c.esperado.matriculaTotal, valor[REPASSE[c.repasse]!], periodo);
      expect(v.valor).toBeCloseTo(c.esperado.valor, 4);
      expect(v.custoEvadido).toBeCloseTo(c.esperado.custoEvadido, 4);
    },
  );
});
