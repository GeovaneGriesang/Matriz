import { describe, it, expect } from "vitest";
import { calcularRazaoDocenteAluno } from "@/calculation-engine/qualidadeEficiencia/rap/calcularRazaoDocenteAluno";
import { weightRegimeTrabalho } from "@/calculation-engine/qualidadeEficiencia/rap/weightRegimeTrabalho";
import { bucketizeRap } from "@/calculation-engine/qualidadeEficiencia/rap/bucketizeRap";
import { calcularBlocoRap } from "@/calculation-engine/qualidadeEficiencia/rap/calcularBlocoRap";
import { PESO_RAP_SUBBLOCO } from "@/calculation-engine/constants/blocos.constants";

describe("weightRegimeTrabalho", () => {
  it.each([
    ["DEDICACAO_EXCLUSIVA", 1.0],
    ["QUARENTA_HORAS", 0.75],
    ["VINTE_HORAS", 0.5],
  ] as const)("mapeia o regime %s para o peso %f", (regime, esperado) => {
    expect(weightRegimeTrabalho(regime)).toBe(esperado);
  });
});

describe("calcularRazaoDocenteAluno", () => {
  it("pondera docentes por regime antes de dividir pelos alunos presenciais", () => {
    const resultado = calcularRazaoDocenteAluno({
      campusId: 1,
      docentes: [
        { regime: "DEDICACAO_EXCLUSIVA", quantidade: 10 }, // 10 * 1.0 = 10
        { regime: "VINTE_HORAS", quantidade: 4 }, // 4 * 0.5 = 2
      ],
      alunosPresenciais: 100,
    });

    expect(resultado.docentesEquivalentes).toBe(12);
    expect(resultado.razaoDocenteAluno).toBeCloseTo(0.12, 9);
  });

  it("retorna razão 0 quando não há alunos presenciais (evita divisão por zero)", () => {
    const resultado = calcularRazaoDocenteAluno({
      campusId: 1,
      docentes: [{ regime: "DEDICACAO_EXCLUSIVA", quantidade: 5 }],
      alunosPresenciais: 0,
    });
    expect(resultado.razaoDocenteAluno).toBe(0);
  });
});

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
        {
          campusId: 1,
          docentes: [{ regime: "DEDICACAO_EXCLUSIVA", quantidade: 50 }],
          alunosPresenciais: 100, // razão 0.5 -> MUITO_ALTA -> peso 2.5
        },
        {
          campusId: 2,
          docentes: [{ regime: "DEDICACAO_EXCLUSIVA", quantidade: 2 }],
          alunosPresenciais: 100, // razão 0.02 -> MUITO_BAIXA -> peso 0.5
        },
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
