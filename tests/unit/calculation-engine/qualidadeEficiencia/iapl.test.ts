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
  it("distribui cada meta proporcionalmente às matrículas da categoria por instituição (1 câmpus cada)", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = calcularBlocoIapl(
      [
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 300, matriculasFormacaoProfessores: 20, matriculasProeja: 50 },
        { campusId: 2, instituicaoId: 20, matriculasTecnicos: 100, matriculasFormacaoProfessores: 20, matriculasProeja: 50 },
      ],
      orcamentoTotal,
    );

    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    const inst20 = resultado.find((r) => r.instituicaoId === 20)!;

    // instituição 10 tem 3x mais matrículas técnicas -> 3x o valor de técnicos
    expect(inst10.valorTecnicos).toBeCloseTo(inst20.valorTecnicos * 3, 6);
    // PROEJA e formação de professores são iguais entre as duas -> valores iguais
    expect(inst10.valorProeja).toBeCloseTo(inst20.valorProeja, 6);
    expect(inst10.valorFormacaoProfessores).toBeCloseTo(inst20.valorFormacaoProfessores, 6);

    const somaTotal = resultado.reduce((total, r) => total + r.valorTotal, 0);
    expect(somaTotal).toBeCloseTo(PESO_IAPL_SUBBLOCO * orcamentoTotal, 6);
  });

  it("soma as matrículas de todos os câmpus da mesma instituição antes de calcular o share", () => {
    const resultado = calcularBlocoIapl(
      [
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 150, matriculasFormacaoProfessores: 0, matriculasProeja: 0 },
        { campusId: 2, instituicaoId: 10, matriculasTecnicos: 150, matriculasFormacaoProfessores: 0, matriculasProeja: 0 },
        { campusId: 3, instituicaoId: 20, matriculasTecnicos: 100, matriculasFormacaoProfessores: 0, matriculasProeja: 0 },
      ],
      1_000_000,
    );

    expect(resultado).toHaveLength(2);
    const inst10 = resultado.find((r) => r.instituicaoId === 10)!;
    expect(inst10.matriculasTecnicos).toBe(300);
  });

  it("quando uma categoria não tem matrículas em nenhuma instituição, todas recebem 0 nessa categoria (valor não distribuído)", () => {
    const resultado = calcularBlocoIapl(
      [
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 300, matriculasFormacaoProfessores: 0, matriculasProeja: 50 },
        { campusId: 2, instituicaoId: 20, matriculasTecnicos: 100, matriculasFormacaoProfessores: 0, matriculasProeja: 50 },
      ],
      1_000_000,
    );
    expect(resultado.every((r) => r.valorFormacaoProfessores === 0)).toBe(true);
  });

  it("retorna lista vazia quando não há câmpus", () => {
    expect(calcularBlocoIapl([], 1_000_000)).toEqual([]);
  });
});
