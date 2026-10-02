import { describe, expect, it } from "vitest";
import { diferencaParaPrincipal, diferencasContra, mesmoCurso, mesmoPeso, modoDoParametro, passaNoFiltro } from "@/lib/compararCursos";

const eng = { curso: "ENGENHARIA CIVIL", peso: 2.5 };

describe("comparação de cursos entre câmpus", () => {
  it("o filtro vem da URL e qualquer coisa desconhecida vira 'todos'", () => {
    expect(modoDoParametro("curso")).toBe("curso");
    expect(modoDoParametro("peso")).toBe("peso");
    expect(modoDoParametro("outro")).toBe("todos");
    expect(modoDoParametro(undefined)).toBe("todos");
  });

  it("mesmo curso ignora maiúsculas, acento e espaço repetido", () => {
    expect(mesmoCurso({ curso: "Engenharia  Civil" }, eng)).toBe(true);
    expect(mesmoCurso({ curso: "ADMINISTRAÇÃO" }, { curso: "administracao" })).toBe(true);
    expect(mesmoCurso({ curso: "ENGENHARIA CIVIL" }, { curso: "ENGENHARIA DE PRODUCAO" })).toBe(false);
  });

  it("mesmo peso exige peso informado nos dois", () => {
    expect(mesmoPeso({ peso: 2.5 }, { peso: 2.5 })).toBe(true);
    expect(mesmoPeso({ peso: 2.5 }, { peso: 1 })).toBe(false);
    expect(mesmoPeso({ peso: null }, { peso: null })).toBe(false);
  });

  it("o filtro limita as opções: todos deixa passar, curso e peso restringem", () => {
    const producao = { curso: "ENGENHARIA DE PRODUCAO", peso: 2.5 };
    const informatica = { curso: "TECNICO EM INFORMATICA", peso: 1.5 };
    expect(passaNoFiltro("todos", eng, informatica)).toBe(true);
    expect(passaNoFiltro("curso", eng, producao)).toBe(false);
    expect(passaNoFiltro("peso", eng, producao)).toBe(true);
    expect(passaNoFiltro("peso", eng, informatica)).toBe(false);
  });

  it("a diferença é do principal em relação ao outro: positiva é ganho do principal", () => {
    const d = diferencaParaPrincipal(150, 100)!;
    expect(d.absoluta).toBe(50);
    expect(d.percentual).toBeCloseTo(0.5, 9);
    expect(diferencaParaPrincipal(50, 100)!.percentual).toBeCloseTo(-0.5, 9);
    expect(diferencaParaPrincipal(10, 0)!.percentual).toBeNull();
    expect(diferencaParaPrincipal(null, 5)).toBeNull();
  });

  it("o valor por aluno usa os alunos de cada curso", () => {
    const a = { valor: 1000, matricula: 10, alunos: 10, perda: 5, peso: 2.5, chMatriz: 3600 };
    const b = { valor: 1500, matricula: 20, alunos: 30, perda: 8, peso: 2.5, chMatriz: 3600 };
    const d = diferencasContra(a, b);
    expect(d.valor!.absoluta).toBe(-500);
    // O principal rende R$ 100 por aluno e o outro R$ 50: o principal ganha por aluno mesmo recebendo menos no total.
    expect(d.valorPorAluno!.absoluta).toBe(50);
    expect(d.peso!.absoluta).toBe(0);
    expect(diferencasContra({ ...a, alunos: null }, b).valorPorAluno).toBeNull();
  });
});
