import { describe, it, expect } from "vitest";
import { blocoQualidadeEficiencia } from "@/calculation-engine/blocoQualidadeEficiencia";
import {
  PESO_BLOCO_QUALIDADE_EFICIENCIA,
  PESO_IEA_SUBBLOCO,
  PESO_RAP_SUBBLOCO,
  PESO_IAPL_SUBBLOCO,
} from "@/calculation-engine/constants/blocos.constants";

describe("blocoQualidadeEficiencia", () => {
  it("os pesos dos sub-blocos somam ao peso total do bloco", () => {
    expect(PESO_IEA_SUBBLOCO + PESO_RAP_SUBBLOCO + PESO_IAPL_SUBBLOCO).toBeCloseTo(
      PESO_BLOCO_QUALIDADE_EFICIENCIA,
      9,
    );
  });

  it("compõe IEA + RAP + IAPL por instituição (não por câmpus) e a soma total bate com o bloco de 10%", () => {
    const orcamentoTotal = 1_000_000;
    const resultado = blocoQualidadeEficiencia(
      [
        { campusId: 1, instituicaoId: 10, concluidos: 90, evadidos: 10, retidos: 0 },
        { campusId: 2, instituicaoId: 20, concluidos: 30, evadidos: 70, retidos: 0 },
      ],
      [
        { campusId: 1, instituicaoId: 10, matriculasPresenciais: 440, professorEquivalente: 20 },
        { campusId: 2, instituicaoId: 20, matriculasPresenciais: 380, professorEquivalente: 20 },
      ],
      [
        { campusId: 1, instituicaoId: 10, matriculasTecnicos: 300, matriculasFormacaoProfessores: 10, matriculasProeja: 50, matriculasGeral: 100 },
        { campusId: 2, instituicaoId: 20, matriculasTecnicos: 100, matriculasFormacaoProfessores: 10, matriculasProeja: 50, matriculasGeral: 100 },
      ],
      orcamentoTotal,
    );

    expect(resultado).toHaveLength(2);

    const somaTotal = resultado.reduce((total, r) => total + r.valorTotal, 0);
    expect(somaTotal).toBeCloseTo(PESO_BLOCO_QUALIDADE_EFICIENCIA * orcamentoTotal, 6);

    for (const r of resultado) {
      expect(r.valorTotal).toBeCloseTo(r.valorIea + r.valorRap + r.valorIapl, 9);
    }
  });
});
