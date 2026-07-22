import { describe, it, expect } from "vitest";
import { labInfraWeight } from "@/calculation-engine/alunoMatriz/labInfraWeight";

describe("labInfraWeight", () => {
  it.each([
    [1, 1.0],
    [2, 1.5],
    [3, 2.0],
    [4, 2.5],
  ] as const)("mapeia o tier %i para o peso %f", (tier, esperado) => {
    expect(labInfraWeight(tier)).toBe(esperado);
  });

  it("lança erro para um tier fora do intervalo", () => {
    // @ts-expect-error valor inválido propositalmente para testar o guard
    expect(() => labInfraWeight(5)).toThrow();
  });
});
