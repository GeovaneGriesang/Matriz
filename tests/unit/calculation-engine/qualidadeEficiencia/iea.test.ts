import { describe, it, expect } from "vitest";
import { bucketizeIea } from "@/calculation-engine/qualidadeEficiencia/iea/bucketizeIea";
import { weightIea } from "@/calculation-engine/qualidadeEficiencia/iea/weightIea";
import { calcularBlocoIea } from "@/calculation-engine/qualidadeEficiencia/iea/calcularBlocoIea";
import { PESO_IEA_SUBBLOCO } from "@/calculation-engine/constants/blocos.constants";

describe("bucketizeIea", () => {
  it.each([
    [0.1, "MUITO_BAIXO"],
    [0.2, "MUITO_BAIXO"], // limite inclusivo
    [0.3, "BAIXO"],
    [0.4, "BAIXO"],
    [0.5, "MEDIO"],
    [0.6, "MEDIO"],
    [0.7, "ALTO"],
    [0.8, "ALTO"],
    [0.9, "MUITO_ALTO"],
    [1.0, "MUITO_ALTO"],
  ] as const)("classifica IEA %f como %s", (valor, esperado) => {
    expect(bucketizeIea(valor)).toBe(esperado);
  });
});

describe("weightIea", () => {
  it.each([
    ["MUITO_BAIXO", 0.5],
    ["BAIXO", 1.0],
    ["MEDIO", 1.5],
    ["ALTO", 2.0],
    ["MUITO_ALTO", 2.5],
  ] as const)("mapeia a faixa %s para o peso %f", (band, esperado) => {
    expect(weightIea(band)).toBe(esperado);
  });
});

describe("calcularBlocoIea", () => {
  it("equaliza shares somando 1.0 e distribui o valor total do sub-bloco", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIea(
      [
        { campusId: 1, valorIea: 0.9 }, // MUITO_ALTO -> peso 2.5
        { campusId: 2, valorIea: 0.1 }, // MUITO_BAIXO -> peso 0.5
      ],
      orcamentoTotal,
    );

    const somaShares = resultado.reduce((total, r) => total + r.share, 0);
    expect(somaShares).toBeCloseTo(1.0, 9);

    const somaValores = resultado.reduce((total, r) => total + r.valorReais, 0);
    expect(somaValores).toBeCloseTo(PESO_IEA_SUBBLOCO * orcamentoTotal, 6);

    // câmpus 1 tem peso 5x maior que o câmpus 2 (2.5 vs 0.5)
    const campus1 = resultado.find((r) => r.campusId === 1)!;
    const campus2 = resultado.find((r) => r.campusId === 2)!;
    expect(campus1.valorReais).toBeCloseTo(campus2.valorReais * 5, 6);
  });

  it("retorna lista vazia quando não há câmpus", () => {
    expect(calcularBlocoIea([], 1_000_000)).toEqual([]);
  });
});
