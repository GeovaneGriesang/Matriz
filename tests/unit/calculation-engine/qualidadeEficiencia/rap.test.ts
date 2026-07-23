import { describe, it, expect } from "vitest";
import { bucketizeRap } from "@/calculation-engine/qualidadeEficiencia/rap/bucketizeRap";
import { calcularBlocoRap } from "@/calculation-engine/qualidadeEficiencia/rap/calcularBlocoRap";
import { PESO_RAP_SUBBLOCO } from "@/calculation-engine/constants/blocos.constants";

describe("bucketizeRap", () => {
  it.each([
    [0.02, "MUITO_BAIXA"],
    [0.05, "MUITO_BAIXA"],
    [0.08, "BAIXA"],
    [0.15, "MEDIA"],
    [0.2, "ALTA"],
    [0.5, "MUITO_ALTA"],
  ] as const)("classifica a razão %f como %s", (razao, esperado) => {
    expect(bucketizeRap(razao)).toBe(esperado);
  });
});

describe("calcularBlocoRap", () => {
  it("equaliza shares somando 1.0 e distribui o valor total do sub-bloco", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoRap(
      [
        { campusId: 1, razaoDocenteAluno: 0.5 }, // MUITO_ALTA -> peso 2.5
        { campusId: 2, razaoDocenteAluno: 0.02 }, // MUITO_BAIXA -> peso 0.5
      ],
      orcamentoTotal,
    );

    const somaShares = resultado.reduce((total, r) => total + r.share, 0);
    expect(somaShares).toBeCloseTo(1.0, 9);

    const somaValores = resultado.reduce((total, r) => total + r.valorReais, 0);
    expect(somaValores).toBeCloseTo(PESO_RAP_SUBBLOCO * orcamentoTotal, 6);
  });

  it("retorna lista vazia quando não há câmpus", () => {
    expect(calcularBlocoRap([], 1_000_000)).toEqual([]);
  });
});
