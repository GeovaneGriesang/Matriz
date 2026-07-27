import { describe, it, expect } from "vitest";
import { calcularMatriculaTotalEqualizada } from "@/calculation-engine/matriculaTotalEqualizada";
import { NotImplementedError } from "@/calculation-engine/errors/NotImplementedError";

describe("calcularMatriculaTotalEqualizada", () => {
  it("soma os 4 componentes (Presencial/EaD/EaD MOOC/EaD FP) do registro oficial", () => {
    const total = calcularMatriculaTotalEqualizada({
      matriculaTotalPresencialEqualizada: 3249.16479,
      matriculaTotalEadEqualizada: 24.9507,
      matriculaTotalEadMoocEqualizada: 10,
      matriculaTotalEadFpEqualizada: 5,
    });
    expect(total).toBeCloseTo(3249.16479 + 24.9507 + 10 + 5, 9);
  });

  it("lança NotImplementedError quando não existe registro para o câmpus/ano-base — não inventa um valor", () => {
    expect(() => calcularMatriculaTotalEqualizada(undefined)).toThrow(NotImplementedError);
  });
});
