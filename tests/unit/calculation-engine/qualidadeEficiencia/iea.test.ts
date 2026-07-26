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
  it("aplica a fórmula oficial IEA = C_ciclo + R_ciclo × (C_ciclo ÷ (C_ciclo + Ev_ciclo))", () => {
    // Caso real validado no documento de metodologia (Campus Cruzeiro do Sul, IFAC, 2024):
    // C=36,30% Ev=55,56% R=8,15% -> IEA=39,52%. Alimentado como um único câmpus (contagens somam 100).
    const resultado = calcularBlocoIea(
      [{ campusId: 1, instituicaoId: 10, concluidos: 36.3, evadidos: 55.56, retidos: 8.15 }],
      1_000_000,
    );
    expect(resultado[0]!.valorIea).toBeCloseTo(0.3952, 4);
  });

  it("soma as contagens absolutas de todos os câmpus da instituição ANTES de calcular o IEA uma única vez", () => {
    // Câmpus A isolado teria IEA=0.95 (MUITO_ALTO); Câmpus B isolado teria IEA=0.05 (MUITO_BAIXO).
    // Agregando as contagens primeiro (correto), a instituição fica em 0.5 (MEDIO) — resultado que
    // não é obtido combinando bandas/pesos já calculados por câmpus.
    const resultado = calcularBlocoIea(
      [
        { campusId: 1, instituicaoId: 10, concluidos: 95, evadidos: 5, retidos: 0 },
        { campusId: 2, instituicaoId: 10, concluidos: 5, evadidos: 95, retidos: 0 },
      ],
      1_000_000,
    );
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.valorIea).toBeCloseTo(0.5, 9);
    expect(resultado[0]!.band).toBe("MEDIO");
    expect(resultado[0]!.peso).toBe(1.5);
  });

  it("equaliza shares somando 1.0 e distribui o valor total do sub-bloco (1 câmpus por instituição)", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIea(
      [
        { campusId: 1, instituicaoId: 10, concluidos: 90, evadidos: 10, retidos: 0 }, // IEA 0.9 -> MUITO_ALTO -> peso 2.5
        { campusId: 2, instituicaoId: 20, concluidos: 10, evadidos: 90, retidos: 0 }, // IEA 0.1 -> MUITO_BAIXO -> peso 0.5
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

  it("soma as contagens de todos os câmpus da mesma instituição no resultado (porCampus) mesmo com o cálculo unificado", () => {
    const resultado = calcularBlocoIea(
      [
        { campusId: 1, instituicaoId: 10, concluidos: 45, evadidos: 5, retidos: 0 },
        { campusId: 2, instituicaoId: 10, concluidos: 45, evadidos: 5, retidos: 0 },
        { campusId: 3, instituicaoId: 20, concluidos: 90, evadidos: 10, retidos: 0 },
      ],
      1_000_000,
    );

    expect(resultado).toHaveLength(2);
    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    const inst20 = resultado.find((r) => r.instituicaoId === 20)!;
    // As duas instituições têm a mesma proporção agregada (90/10) -> mesmo IEA, mesmo ponderado, mesmo valor.
    expect(inst10.valorIea).toBeCloseTo(inst20.valorIea, 9);
    expect(inst10.valorReais).toBeCloseTo(inst20.valorReais, 6);
    expect(inst10.porCampus).toHaveLength(2);
  });

  it("override por instituição substitui o IEA calculado (simulador)", () => {
    const resultado = calcularBlocoIea(
      [{ campusId: 1, instituicaoId: 10, concluidos: 90, evadidos: 10, retidos: 0 }], // IEA real 0.9
      1_000_000,
      new Map([[10, 0.1]]), // simula IEA 0.1 para a instituição 10
    );
    expect(resultado[0]!.valorIea).toBe(0.1);
    expect(resultado[0]!.band).toBe("MUITO_BAIXO");
  });

  it("retorna lista vazia quando não há câmpus nem overrides", () => {
    expect(calcularBlocoIea([], 1_000_000)).toEqual([]);
  });
});
