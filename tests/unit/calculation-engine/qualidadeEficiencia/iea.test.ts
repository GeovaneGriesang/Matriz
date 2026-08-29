import { describe, it, expect } from "vitest";
import { bucketizeIea } from "@/calculation-engine/qualidadeEficiencia/iea/bucketizeIea";
import { weightIea } from "@/calculation-engine/qualidadeEficiencia/iea/weightIea";
import { calcularBlocoIea } from "@/calculation-engine/qualidadeEficiencia/iea/calcularBlocoIea";
import { PESO_IEA_SUBBLOCO } from "@/calculation-engine/constants/blocos.constants";

describe("bucketizeIea — PLANILHA_2026 (padrão, sem passar estratégia)", () => {
  it.each([
    [0.1, "MUITO_BAIXO"],
    [0.4149, "MUITO_BAIXO"], // limite inclusivo
    [0.45, "BAIXO"],
    [0.461, "BAIXO"], // limite inclusivo
    [0.48, "MEDIO"],
    [0.5071, "MEDIO"], // limite inclusivo
    [0.52, "ALTO"],
    [0.5532, "ALTO"], // limite inclusivo
    [0.6, "MUITO_ALTO"],
    [0.9, "MUITO_ALTO"],
  ] as const)("classifica IEA %f como %s", (valor, esperado) => {
    expect(bucketizeIea(valor)).toBe(esperado);
  });
});

describe("bucketizeIea — PLANILHA_2027 (explícito)", () => {
  it.each([
    [0.1, "MUITO_BAIXO"],
    [0.441, "MUITO_BAIXO"], // limite inclusivo (0,90 x 49,0%)
    [0.4411, "BAIXO"],
    [0.49, "BAIXO"], // limite inclusivo (a própria média da rede)
    [0.4901, "MEDIO"],
    [0.539, "MEDIO"], // limite inclusivo (1,10 x 49,0%)
    [0.5391, "ALTO"],
    [0.588, "ALTO"], // limite inclusivo (1,20 x 49,0%)
    [0.6, "MUITO_ALTO"],
  ] as const)("classifica IEA %f como %s", (valor, esperado) => {
    expect(bucketizeIea(valor, "PLANILHA_2027")).toBe(esperado);
  });
});

describe("bucketizeIea — os ciclos divergem para o mesmo valor", () => {
  it("0,47 é MEDIO em 2026 mas BAIXO em 2027 (a média da rede subiu de 46,1% para 49,0%)", () => {
    expect(bucketizeIea(0.47)).toBe("MEDIO");
    expect(bucketizeIea(0.47, "PLANILHA_2027")).toBe("BAIXO");
  });
});

describe("weightIea", () => {
  it.each([
    ["MUITO_BAIXO", 0.5],
    ["BAIXO", 1.0],
    ["MEDIO", 1.5],
    ["ALTO", 2.0],
    ["MUITO_ALTO", 2.5],
  ] as const)("mapeia a faixa %s para o peso %f (mesmo valor nos dois ciclos)", (band, esperado) => {
    expect(weightIea(band)).toBe(esperado);
    expect(weightIea(band, "PLANILHA_2027")).toBe(esperado);
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

  it("expõe qual estratégia foi usada no resultado, para a memória de cálculo indicar sempre a origem da faixa", () => {
    const resultadoPadrao = calcularBlocoIea(
      [{ campusId: 1, instituicaoId: 10, concluidos: 45, evadidos: 55, retidos: 0 }], // IEA 0.45
      1_000_000,
    );
    expect(resultadoPadrao[0]!.estrategia).toBe("PLANILHA_2026");

    const resultado2027 = calcularBlocoIea(
      [{ campusId: 1, instituicaoId: 10, concluidos: 45, evadidos: 55, retidos: 0 }],
      1_000_000,
      undefined,
      "PLANILHA_2027",
    );
    expect(resultado2027[0]!.estrategia).toBe("PLANILHA_2027");
  });

  it("os dois ciclos podem produzir banda/peso/valor diferentes para o mesmo IEA calculado (0.47)", () => {
    const inputs = [{ campusId: 1, instituicaoId: 10, concluidos: 47, evadidos: 53, retidos: 0 }];
    const padrao = calcularBlocoIea(inputs, 1_000_000)[0]!; // PLANILHA_2026 -> MEDIO -> peso 1.5
    const forplan = calcularBlocoIea(inputs, 1_000_000, undefined, "PLANILHA_2027")[0]!; // BAIXO -> peso 1.0

    expect(padrao.band).toBe("MEDIO");
    expect(padrao.peso).toBe(1.5);
    expect(forplan.band).toBe("BAIXO");
    expect(forplan.peso).toBe(1.0);
    // Mesmo IEA calculado, faixa diferente -> valor distribuído diferente (única instituição, share sempre 1.0,
    // mas o valor em si não depende do peso quando há só uma instituição — a diferença aparece no ponderado).
    expect(padrao.ponderado).toBeCloseTo(0.47 * 1.5, 9);
    expect(forplan.ponderado).toBeCloseTo(0.47 * 1.0, 9);
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
