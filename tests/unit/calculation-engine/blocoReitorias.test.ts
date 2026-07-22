import { describe, it, expect } from "vitest";
import { blocoReitorias } from "@/calculation-engine/blocoReitorias";
import {
  PESO_BLOCO_REITORIAS,
  NUMERO_AUTARQUIAS_REDE_FEDERAL,
} from "@/calculation-engine/constants/blocos.constants";

describe("blocoReitorias", () => {
  it("divide o bloco igualitariamente entre as 41 autarquias da Rede Federal", () => {
    const orcamentoTotal = 41_000_000;
    const autarquiaIds = Array.from({ length: NUMERO_AUTARQUIAS_REDE_FEDERAL }, (_, i) => i + 1);

    const resultado = blocoReitorias(autarquiaIds, orcamentoTotal);

    expect(resultado).toHaveLength(NUMERO_AUTARQUIAS_REDE_FEDERAL);
    const valorEsperado = (orcamentoTotal * PESO_BLOCO_REITORIAS) / NUMERO_AUTARQUIAS_REDE_FEDERAL;
    for (const r of resultado) {
      expect(r.valorReais).toBeCloseTo(valorEsperado, 6);
    }

    const somaTotal = resultado.reduce((total, r) => total + r.valorReais, 0);
    expect(somaTotal).toBeCloseTo(PESO_BLOCO_REITORIAS * orcamentoTotal, 6);
  });

  it("retorna lista vazia quando não há autarquias", () => {
    expect(blocoReitorias([], 1_000_000)).toEqual([]);
  });
});
