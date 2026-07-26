import { describe, it, expect } from "vitest";
import { splitLegal } from "@/calculation-engine/qualidadeEficiencia/iapl/splitLegal";
import { calcularBlocoIapl } from "@/calculation-engine/qualidadeEficiencia/iapl/calcularBlocoIapl";
import { pesoIaplFormacaoProfessores, pesoIaplProeja, pesoIaplTecnicos } from "@/calculation-engine/qualidadeEficiencia/iapl/bucketizeIapl";
import { IAPL_SPLIT } from "@/calculation-engine/constants/qualidadeEficiencia.constants";
import { PESO_IAPL_SUBBLOCO } from "@/calculation-engine/constants/blocos.constants";

describe("IAPL_SPLIT", () => {
  it("as três metas legais somam 1.0", () => {
    expect(
      IAPL_SPLIT.CURSOS_TECNICOS + IAPL_SPLIT.FORMACAO_PROFESSORES + IAPL_SPLIT.PROEJA,
    ).toBeCloseTo(1.0, 9);
  });
});

describe("splitLegal", () => {
  it.each([0, 1000, 123.45, 1_000_000])(
    "as três metas somam de volta ao total para um total de %f",
    (total) => {
      const split = splitLegal(total);
      expect(split.tecnicos + split.formacaoProfessores + split.proeja).toBeCloseTo(total, 6);
    },
  );

  it("aplica exatamente 70/20/10 sobre um total de 1000", () => {
    const split = splitLegal(1000);
    expect(split.tecnicos).toBeCloseTo(700, 9);
    expect(split.formacaoProfessores).toBeCloseTo(200, 9);
    expect(split.proeja).toBeCloseTo(100, 9);
  });
});

describe("pesoIaplTecnicos", () => {
  it.each([
    [0.3, 0],
    [0.49, 0],
    [0.5, 1],
    [0.55, 1],
    [0.6, 2],
    [0.8, 2],
  ] as const)("%ME %f -> peso %f", (percentual, esperado) => {
    expect(pesoIaplTecnicos(percentual)).toBe(esperado);
  });
});

describe("pesoIaplFormacaoProfessores", () => {
  it.each([
    [0.05, 0],
    [0.09, 0],
    [0.1, 1],
    [0.12, 1],
    [0.15, 2],
    [0.18, 2],
    [0.2, 2.5],
    [0.3, 2.5],
  ] as const)("%ME %f -> peso %f", (percentual, esperado) => {
    expect(pesoIaplFormacaoProfessores(percentual)).toBe(esperado);
  });
});

describe("pesoIaplProeja", () => {
  it.each([
    [0.01, 0],
    [0.024, 0],
    [0.025, 1],
    [0.04, 1],
    [0.05, 2],
    [0.09, 2],
    [0.1, 2.5],
    [0.2, 2.5],
  ] as const)("%ME %f -> peso %f", (percentual, esperado) => {
    expect(pesoIaplProeja(percentual)).toBe(esperado);
  });
});

describe("calcularBlocoIapl", () => {
  it("enquadra o %ME de cada categoria em faixa/peso e distribui proporcionalmente ao ponderado (%ME × peso), não à matrícula bruta", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIapl(
      [
        // instituição 10: %ME Técnicos = 300/500 = 60% -> peso 2 -> ponderado 1.2
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 300, matriculasFormacaoProfessores: 0, matriculasProeja: 0, matriculasGeral: 500 },
        // instituição 20: %ME Técnicos = 300/1000 = 30% -> peso 0 (abaixo do piso) -> ponderado 0, mesmo tendo a mesma matrícula bruta
        { campusId: 2, instituicaoId: 20, matriculasTecnicos: 300, matriculasFormacaoProfessores: 0, matriculasProeja: 0, matriculasGeral: 1000 },
      ],
      orcamentoTotal,
    );

    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    const inst20 = resultado.find((r) => r.instituicaoId === 20)!;

    expect(inst10.tecnicos.percentualMe).toBeCloseTo(0.6, 9);
    expect(inst10.tecnicos.peso).toBe(2);
    expect(inst20.tecnicos.percentualMe).toBeCloseTo(0.3, 9);
    expect(inst20.tecnicos.peso).toBe(0);

    // instituição 20 não atinge o piso legal -> recebe 0 de Técnicos, mesmo com a mesma matrícula bruta que a 10
    expect(inst20.tecnicos.valorReais).toBe(0);
    expect(inst10.tecnicos.valorReais).toBeCloseTo(PESO_IAPL_SUBBLOCO * orcamentoTotal * IAPL_SPLIT.CURSOS_TECNICOS, 6);

    const somaTotal = resultado.reduce((total, r) => total + r.valorTotal, 0);
    expect(somaTotal).toBeCloseTo(PESO_IAPL_SUBBLOCO * orcamentoTotal * IAPL_SPLIT.CURSOS_TECNICOS, 6);
  });

  it("distribui proporcionalmente ao ponderado quando as duas instituições atingem o piso legal", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIapl(
      [
        // %ME Técnicos = 60% -> peso 2 -> ponderado 1.2
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 300, matriculasFormacaoProfessores: 20, matriculasProeja: 50, matriculasGeral: 500 },
        // %ME Técnicos = 50% -> peso 1 -> ponderado 0.5
        { campusId: 2, instituicaoId: 20, matriculasTecnicos: 100, matriculasFormacaoProfessores: 20, matriculasProeja: 50, matriculasGeral: 200 },
      ],
      orcamentoTotal,
    );

    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    const inst20 = resultado.find((r) => r.instituicaoId === 20)!;

    // ponderado 1.2 vs 0.5 -> razão 2.4x
    expect(inst10.tecnicos.valorReais).toBeCloseTo(inst20.tecnicos.valorReais * 2.4, 6);

    const somaTotal = resultado.reduce((total, r) => total + r.valorTotal, 0);
    expect(somaTotal).toBeCloseTo(PESO_IAPL_SUBBLOCO * orcamentoTotal, 6);
  });

  it("soma as matrículas de todos os câmpus da mesma instituição antes de calcular o %ME", () => {
    const resultado = calcularBlocoIapl(
      [
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 150, matriculasFormacaoProfessores: 0, matriculasProeja: 0, matriculasGeral: 250 },
        { campusId: 2, instituicaoId: 10, matriculasTecnicos: 150, matriculasFormacaoProfessores: 0, matriculasProeja: 0, matriculasGeral: 250 },
        { campusId: 3, instituicaoId: 20, matriculasTecnicos: 100, matriculasFormacaoProfessores: 0, matriculasProeja: 0, matriculasGeral: 500 },
      ],
      1_000_000,
    );

    expect(resultado).toHaveLength(2);
    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    expect(inst10.tecnicos.matriculas).toBe(300);
    expect(inst10.tecnicos.matriculasGeral).toBe(500);
    expect(inst10.tecnicos.percentualMe).toBeCloseTo(0.6, 9);
  });

  it("quando nenhuma instituição atinge o piso legal de uma categoria, todas recebem 0 nessa categoria (valor não distribuído)", () => {
    const resultado = calcularBlocoIapl(
      [
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 300, matriculasFormacaoProfessores: 0, matriculasProeja: 50, matriculasGeral: 1000 },
        { campusId: 2, instituicaoId: 20, matriculasTecnicos: 100, matriculasFormacaoProfessores: 0, matriculasProeja: 50, matriculasGeral: 1000 },
      ],
      1_000_000,
    );
    expect(resultado.every((r) => r.formacaoProfessores.valorReais === 0)).toBe(true);
  });

  it("retorna lista vazia quando não há câmpus", () => {
    expect(calcularBlocoIapl([], 1_000_000)).toEqual([]);
  });
});
