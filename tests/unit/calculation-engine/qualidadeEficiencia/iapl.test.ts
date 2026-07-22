import { describe, it, expect } from "vitest";
import { splitLegal } from "@/calculation-engine/qualidadeEficiencia/iapl/splitLegal";
import { calcularBlocoIapl } from "@/calculation-engine/qualidadeEficiencia/iapl/calcularBlocoIapl";
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

describe("calcularBlocoIapl", () => {
  it("distribui cada meta proporcionalmente às matrículas da categoria por câmpus", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIapl(
      [
        { campusId: 1, matriculasTecnicos: 300, matriculasFormacaoProfessores: 20, matriculasProeja: 50 },
        { campusId: 2, matriculasTecnicos: 100, matriculasFormacaoProfessores: 20, matriculasProeja: 50 },
      ],
      orcamentoTotal,
    );

    const campus1 = resultado.find((r) => r.campusId === 1)!;
    const campus2 = resultado.find((r) => r.campusId === 2)!;

    // câmpus 1 tem 3x mais matrículas técnicas -> 3x o valor de técnicos
    expect(campus1.valorTecnicos).toBeCloseTo(campus2.valorTecnicos * 3, 6);
    // PROEJA e formação de professores são iguais entre os dois -> valores iguais
    expect(campus1.valorProeja).toBeCloseTo(campus2.valorProeja, 6);
    expect(campus1.valorFormacaoProfessores).toBeCloseTo(campus2.valorFormacaoProfessores, 6);

    const somaTotal = resultado.reduce((total, r) => total + r.valorTotal, 0);
    expect(somaTotal).toBeCloseTo(PESO_IAPL_SUBBLOCO * orcamentoTotal, 6);
  });

  it("quando uma categoria não tem matrículas em nenhum câmpus, todos recebem 0 nessa categoria (valor não distribuído)", () => {
    const resultado = calcularBlocoIapl(
      [
        { campusId: 1, matriculasTecnicos: 300, matriculasFormacaoProfessores: 0, matriculasProeja: 50 },
        { campusId: 2, matriculasTecnicos: 100, matriculasFormacaoProfessores: 0, matriculasProeja: 50 },
      ],
      1_000_000,
    );
    expect(resultado.every((r) => r.valorFormacaoProfessores === 0)).toBe(true);
  });

  it("retorna lista vazia quando não há câmpus", () => {
    expect(calcularBlocoIapl([], 1_000_000)).toEqual([]);
  });
});
