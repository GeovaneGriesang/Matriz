import { describe, it, expect } from "vitest";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { PESO_BLOCO_REITORIAS } from "@/calculation-engine/constants/blocos.constants";

describe("blocoReitorias", () => {
  it("retorna 10% do orçamento (já específico da autarquia) para a própria instituição", () => {
    const orcamentoTotal = 44_027_867;
    const instituicaoId = 187;

    const resultado = blocoReitorias(instituicaoId, orcamentoTotal);

    expect(resultado.autarquiaId).toBe(instituicaoId);
    expect(resultado.valorReais).toBeCloseTo(PESO_BLOCO_REITORIAS * orcamentoTotal, 6);
  });
});
