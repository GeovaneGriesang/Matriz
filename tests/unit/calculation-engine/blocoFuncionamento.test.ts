import { describe, it, expect } from "vitest";
import { blocoFuncionamento } from "@/calculation-engine/blocoFuncionamento";
import { PESO_BLOCO_FUNCIONAMENTO } from "@/calculation-engine/constants/blocos.constants";

describe("blocoFuncionamento", () => {
  it("agrega MT_pond por câmpus e distribui proporcionalmente ao share de cada um", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = blocoFuncionamento(
      [
        { campusId: 1, matriculaPonderada: 100 },
        { campusId: 1, matriculaPonderada: 50 }, // duas entradas do mesmo câmpus somam
        { campusId: 2, matriculaPonderada: 50 },
      ],
      orcamentoTotal,
    );

    const campus1 = resultado.find((r) => r.campusId === 1)!;
    const campus2 = resultado.find((r) => r.campusId === 2)!;

    expect(campus1.totalMatriculaPonderada).toBe(150);
    expect(campus2.totalMatriculaPonderada).toBe(50);

    const somaShares = resultado.reduce((total, r) => total + r.share, 0);
    expect(somaShares).toBeCloseTo(1.0, 9);

    const somaValores = resultado.reduce((total, r) => total + r.valorReais, 0);
    expect(somaValores).toBeCloseTo(PESO_BLOCO_FUNCIONAMENTO * orcamentoTotal, 6);

    // câmpus 1 tem 3x a MT_pond do câmpus 2 -> 3x o valor
    expect(campus1.valorReais).toBeCloseTo(campus2.valorReais * 3, 6);
  });

  it("retorna lista vazia quando não há entradas", () => {
    expect(blocoFuncionamento([], 1_000_000)).toEqual([]);
  });
});
