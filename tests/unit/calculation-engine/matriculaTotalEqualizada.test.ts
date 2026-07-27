import { describe, it, expect } from "vitest";
import { calcularMatriculaTotalEqualizadaPonderada } from "@/calculation-engine/matriculaTotalEqualizada";
import { NotImplementedError } from "@/calculation-engine/errors/NotImplementedError";

describe("calcularMatriculaTotalEqualizadaPonderada", () => {
  it("aplica os pesos oficiais por modalidade (Presencial 1 / EAD 0,25 / EAD MOOC e EAD FP 0,8)", () => {
    const ponderada = calcularMatriculaTotalEqualizadaPonderada({
      matriculaTotalPresencialEqualizada: 3249.16479,
      matriculaTotalEadEqualizada: 24.9507,
      matriculaTotalEadMoocEqualizada: 10,
      matriculaTotalEadFpEqualizada: 5,
    });
    // denominador = Presencial*1 + EAD*0,25 + EAD FP*0,8 — EAD MOOC fica de fora.
    expect(ponderada.denominadorFuncionamento).toBeCloseTo(3249.16479 + 24.9507 * 0.25 + 5 * 0.8, 9);
    // adicional MOOC = EAD MOOC*0,8, somado depois (não dilui o MTP dos demais câmpus).
    expect(ponderada.moocAdicionalFuncionamento).toBeCloseTo(10 * 0.8, 9);
    // peso usado pelo Bloco Reitorias = denominador + adicional MOOC (MOOC entra normalmente aqui).
    expect(ponderada.pesoReitorias).toBeCloseTo(ponderada.denominadorFuncionamento + ponderada.moocAdicionalFuncionamento, 9);
  });

  it("lança NotImplementedError quando não existe registro para o câmpus/ano-base — não inventa um valor", () => {
    expect(() => calcularMatriculaTotalEqualizadaPonderada(undefined)).toThrow(NotImplementedError);
  });
});
