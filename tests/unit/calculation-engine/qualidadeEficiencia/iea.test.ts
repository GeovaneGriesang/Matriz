import { describe, it, expect } from "vitest";
import { bucketizeIea } from "@/calculation-engine/qualidadeEficiencia/iea/bucketizeIea";
import { weightIea } from "@/calculation-engine/qualidadeEficiencia/iea/weightIea";
import { calcularBlocoIea } from "@/calculation-engine/qualidadeEficiencia/iea/calcularBlocoIea";
import { PESO_IEA_SUBBLOCO } from "@/calculation-engine/constants/blocos.constants";

describe("bucketizeIea", () => {
  it.each([
    [0.1, "MUITO_BAIXO"],
    [0.3, "MUITO_BAIXO"],
    [0.4707, "MUITO_BAIXO"], // limite inclusivo
    [0.48, "MEDIO"],
    [0.5178, "MEDIO"], // limite inclusivo
    [0.52, "ALTO"],
    [0.5648, "ALTO"], // limite inclusivo
    [0.6, "MUITO_ALTO"],
    [0.9, "MUITO_ALTO"],
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
  it("equaliza shares somando 1.0 e distribui o valor total do sub-bloco (1 câmpus por instituição)", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIea(
      [
        { campusId: 1, instituicaoId: 10, valorIea: 0.9 }, // MUITO_ALTO -> peso 2.5
        { campusId: 2, instituicaoId: 20, valorIea: 0.1 }, // MUITO_BAIXO -> peso 0.5
      ],
      orcamentoTotal,
    );

    const somaShares = resultado.reduce((total, r) => total + r.share, 0);
    expect(somaShares).toBeCloseTo(1.0, 9);

    const somaValores = resultado.reduce((total, r) => total + r.valorReais, 0);
    expect(somaValores).toBeCloseTo(PESO_IEA_SUBBLOCO * orcamentoTotal, 6);

    // IEA Ponderado = IEA × Peso: instituição 10 = 0.9 × 2.5 = 2.25, instituição 20 = 0.1 × 0.5 = 0.05 → razão 45x
    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    const inst20 = resultado.find((r) => r.instituicaoId === 20)!;
    expect(inst10.valorReais).toBeCloseTo(inst20.valorReais * 45, 6);
  });

  it("soma o IEA Ponderado de todos os câmpus da mesma instituição antes de calcular o share", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIea(
      [
        { campusId: 1, instituicaoId: 10, valorIea: 0.9 }, // MUITO_ALTO -> peso 2.5 -> ponderado 2.25
        { campusId: 2, instituicaoId: 10, valorIea: 0.9 }, // mesmo câmpus/instituição -> +2.25
        { campusId: 3, instituicaoId: 20, valorIea: 0.9 }, // instituição diferente, só 1 câmpus -> 2.25
      ],
      orcamentoTotal,
    );

    expect(resultado).toHaveLength(2);
    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    const inst20 = resultado.find((r) => r.instituicaoId === 20)!;
    // instituição 10 tem 2 câmpus com o mesmo IEA -> ponderado (e valor) 2x o da instituição 20
    expect(inst10.ponderadoInstituicao).toBeCloseTo(inst20.ponderadoInstituicao * 2, 6);
    expect(inst10.valorReais).toBeCloseTo(inst20.valorReais * 2, 6);
    expect(inst10.porCampus).toHaveLength(2);
  });

  it("retorna lista vazia quando não há câmpus", () => {
    expect(calcularBlocoIea([], 1_000_000)).toEqual([]);
  });
});
