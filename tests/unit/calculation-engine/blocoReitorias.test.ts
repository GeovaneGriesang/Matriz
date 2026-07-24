import { describe, it, expect } from "vitest";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { PESO_BLOCO_REITORIAS } from "@/calculation-engine/constants/blocos.constants";

describe("blocoReitorias", () => {
  it("divide os 10% do orçamento proporcionalmente à matrícula ponderada de cada instituição", () => {
    const orcamentoTotal = 44_027_867;
    const inputs = [
      { instituicaoId: 187, matriculaPonderada: 3000 },
      { instituicaoId: 187, matriculaPonderada: 1000 }, // dois câmpus da mesma instituição somam
      { instituicaoId: 181, matriculaPonderada: 4000 },
      { instituicaoId: 166, matriculaPonderada: 2000 },
    ];

    const resultado = blocoReitorias(inputs, orcamentoTotal);

    const valorBloco = PESO_BLOCO_REITORIAS * orcamentoTotal;
    const totalGeral = 10_000;
    expect(resultado).toHaveLength(3);

    const porId = new Map(resultado.map((r) => [r.autarquiaId, r]));
    expect(porId.get(187)?.totalMatriculaPonderada).toBe(4000);
    expect(porId.get(187)?.share).toBeCloseTo(4000 / totalGeral, 6);
    expect(porId.get(187)?.valorReais).toBeCloseTo((4000 / totalGeral) * valorBloco, 6);

    expect(porId.get(181)?.totalMatriculaPonderada).toBe(4000);
    expect(porId.get(181)?.valorReais).toBeCloseTo((4000 / totalGeral) * valorBloco, 6);

    expect(porId.get(166)?.totalMatriculaPonderada).toBe(2000);
    expect(porId.get(166)?.valorReais).toBeCloseTo((2000 / totalGeral) * valorBloco, 6);

    const somaValores = resultado.reduce((s, r) => s + r.valorReais, 0);
    expect(somaValores).toBeCloseTo(valorBloco, 6);
  });

  it("retorna lista vazia quando não há inputs no escopo", () => {
    expect(blocoReitorias([], 1_000_000)).toEqual([]);
  });

  it("retorna share zero para todas quando a matrícula ponderada total é zero", () => {
    const resultado = blocoReitorias(
      [
        { instituicaoId: 1, matriculaPonderada: 0 },
        { instituicaoId: 2, matriculaPonderada: 0 },
      ],
      1_000_000,
    );

    for (const r of resultado) {
      expect(r.share).toBe(0);
      expect(r.valorReais).toBe(0);
    }
  });
});
