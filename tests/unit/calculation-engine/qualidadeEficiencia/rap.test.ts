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
  it("calcula RAP Presencial (aproximado) = Σ matrículas presenciais ÷ Σ Professor Equivalente uma única vez por instituição", () => {
    // Câmpus A isolado teria RAP = 100/10 = 10 (MUITO_BAIXA); Câmpus B isolado teria RAP = 5/1 = 5 (MUITO_BAIXA).
    // Somando primeiro (correto): (100+5)/(10+1) = 105/11 ≈ 9,545 — resultado que não é a média das razões.
    const resultado = calcularBlocoRap(
      [
        { campusId: 1, instituicaoId: 10, matriculasPresenciais: 100, professorEquivalente: 10 },
        { campusId: 2, instituicaoId: 10, matriculasPresenciais: 5, professorEquivalente: 1 },
      ],
      1_000_000,
    );
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.razaoDocenteAluno).toBeCloseTo(105 / 11, 9);
  });

  it("equaliza shares somando 1.0 e distribui o valor total do sub-bloco (1 câmpus por instituição)", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoRap(
      [
        { campusId: 1, instituicaoId: 10, matriculasPresenciais: 410, professorEquivalente: 20 }, // RAP 20.5 -> MEDIA -> peso 2.0
        { campusId: 2, instituicaoId: 20, matriculasPresenciais: 380, professorEquivalente: 20 }, // RAP 19 -> BAIXA -> peso 1.0
      ],
      orcamentoTotal,
    );

    const somaShares = resultado.reduce((total, r) => total + r.share, 0);
    expect(somaShares).toBeCloseTo(1.0, 9);

    const somaValores = resultado.reduce((total, r) => total + r.valorReais, 0);
    expect(somaValores).toBeCloseTo(PESO_RAP_SUBBLOCO * orcamentoTotal, 6);
  });

  it("soma matrículas presenciais e Professor Equivalente de todos os câmpus da mesma instituição no resultado", () => {
    const resultado = calcularBlocoRap(
      [
        { campusId: 1, instituicaoId: 10, matriculasPresenciais: 220, professorEquivalente: 10 },
        { campusId: 2, instituicaoId: 10, matriculasPresenciais: 220, professorEquivalente: 10 },
        { campusId: 3, instituicaoId: 20, matriculasPresenciais: 220, professorEquivalente: 10 },
      ],
      1_000_000,
    );

    expect(resultado).toHaveLength(2);
    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    const inst20 = resultado.find((r) => r.instituicaoId === 20)!;
    // As duas instituições têm a mesma razão agregada (22) -> mesmo RAP, mesmo ponderado, mesmo valor.
    expect(inst10.razaoDocenteAluno).toBeCloseTo(inst20.razaoDocenteAluno, 9);
    expect(inst10.valorReais).toBeCloseTo(inst20.valorReais, 6);
    expect(inst10.porCampus).toHaveLength(2);
    expect(inst10.matriculasPresenciais).toBe(440);
    expect(inst10.professorEquivalente).toBe(20);
  });

  it("override por instituição substitui a razão calculada (simulador)", () => {
    const resultado = calcularBlocoRap(
      [{ campusId: 1, instituicaoId: 10, matriculasPresenciais: 440, professorEquivalente: 20 }], // RAP real 22
      1_000_000,
      new Map([[10, 15]]), // simula RAP 15 para a instituição 10
    );
    expect(resultado[0]!.razaoDocenteAluno).toBe(15);
    expect(resultado[0]!.band).toBe("MUITO_BAIXA");
  });

  it("retorna lista vazia quando não há câmpus nem overrides", () => {
    expect(calcularBlocoRap([], 1_000_000)).toEqual([]);
  });
});
