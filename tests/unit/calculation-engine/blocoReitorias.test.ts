import { describe, it, expect } from "vitest";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import { PESO_BLOCO_REITORIAS } from "@/calculation-engine/constants/blocos.constants";

describe("blocoReitorias", () => {
  it("divide os 10% do orçamento igualmente entre as autarquias do escopo", () => {
    const orcamentoTotal = 44_027_867;
    const autarquiaIds = [187, 181, 166];

    const resultado = blocoReitorias(autarquiaIds, orcamentoTotal);

    const valorEsperadoPorAutarquia = (PESO_BLOCO_REITORIAS * orcamentoTotal) / autarquiaIds.length;
    expect(resultado).toHaveLength(3);
    for (const r of resultado) {
      expect(autarquiaIds).toContain(r.autarquiaId);
      expect(r.valorReais).toBeCloseTo(valorEsperadoPorAutarquia, 6);
    }
  });

  it("retorna lista vazia quando não há autarquias no escopo", () => {
    expect(blocoReitorias([], 1_000_000)).toEqual([]);
  });
});
