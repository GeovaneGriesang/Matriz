import { describe, it, expect } from "vitest";
import { bucketizeRap } from "@/calculation-engine/qualidadeEficiencia/rap/bucketizeRap";
import { calcularBlocoRap } from "@/calculation-engine/qualidadeEficiencia/rap/calcularBlocoRap";
import { PESO_RAP_SUBBLOCO } from "@/calculation-engine/constants/blocos.constants";

describe("bucketizeRap", () => {
  it.each([
    [10, "MUITO_BAIXA"],
    [17.99, "MUITO_BAIXA"], // limite inclusivo
    [18, "BAIXA"],
    [19.99, "BAIXA"], // limite inclusivo
    [20, "MEDIA"],
    [21.99, "MEDIA"], // limite inclusivo
    [22, "MUITO_ALTA"],
    [30, "MUITO_ALTA"],
  ] as const)("classifica a razão %f como %s", (razao, esperado) => {
    expect(bucketizeRap(razao)).toBe(esperado);
  });
});

describe("calcularBlocoRap", () => {
  it("equaliza shares somando 1.0 e distribui o valor total do sub-bloco", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoRap(
      [
        { campusId: 1, razaoDocenteAluno: 20.5 }, // MEDIA -> peso 2.0
        { campusId: 2, razaoDocenteAluno: 19 }, // BAIXA -> peso 1.0
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
