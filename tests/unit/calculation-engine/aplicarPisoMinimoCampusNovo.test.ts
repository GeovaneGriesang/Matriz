import { describe, it, expect } from "vitest";
import { aplicarPisoMinimoCampusNovo } from "@/calculation-engine/aplicarPisoMinimoCampusNovo";
import type { FuncionamentoResult } from "@/calculation-engine/blocoFuncionamento";

function resultado(campusId: number, valorReais: number): FuncionamentoResult {
  return { campusId, totalMatriculaPonderada: 0, share: 0, valorReais };
}

describe("aplicarPisoMinimoCampusNovo", () => {
  it("eleva ao piso um câmpus novo (>= 2018) cujo valor calculado ficou abaixo dele", () => {
    const [r] = aplicarPisoMinimoCampusNovo(
      [resultado(1, 500_000)],
      new Map([[1, 2020]]),
      700_000,
    );
    expect(r?.valorReais).toBe(700_000);
    expect(r?.pisoAplicado).toBe(true);
    expect(r?.valorAntesDoPiso).toBe(500_000);
  });

  it("não altera um câmpus novo cujo valor calculado já supera o piso", () => {
    const [r] = aplicarPisoMinimoCampusNovo(
      [resultado(1, 900_000)],
      new Map([[1, 2019]]),
      700_000,
    );
    expect(r?.valorReais).toBe(900_000);
    expect(r?.pisoAplicado).toBe(false);
  });

  it("não aplica o piso a um câmpus criado antes de 2018", () => {
    const [r] = aplicarPisoMinimoCampusNovo(
      [resultado(1, 100_000)],
      new Map([[1, 2017]]),
      700_000,
    );
    expect(r?.valorReais).toBe(100_000);
    expect(r?.pisoAplicado).toBe(false);
  });

  it("não aplica o piso quando anoCriacao é desconhecido (null/ausente do map)", () => {
    const [semAno] = aplicarPisoMinimoCampusNovo(
      [resultado(1, 100_000)],
      new Map([[1, null]]),
      700_000,
    );
    expect(semAno?.valorReais).toBe(100_000);
    expect(semAno?.pisoAplicado).toBe(false);

    const [foraDoMap] = aplicarPisoMinimoCampusNovo([resultado(2, 100_000)], new Map(), 700_000);
    expect(foraDoMap?.valorReais).toBe(100_000);
    expect(foraDoMap?.pisoAplicado).toBe(false);
  });

  it("piso 0 desativa a regra mesmo para câmpus novo com valor baixo", () => {
    const [r] = aplicarPisoMinimoCampusNovo([resultado(1, 0)], new Map([[1, 2025]]), 0);
    expect(r?.valorReais).toBe(0);
    expect(r?.pisoAplicado).toBe(false);
  });
});
