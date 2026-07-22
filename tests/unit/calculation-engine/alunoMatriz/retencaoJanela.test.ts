import { describe, it, expect } from "vitest";
import { retencaoJanela, pesoRetencao } from "@/calculation-engine/alunoMatriz/retencaoJanela";

function diasDepois(inicio: Date, dias: number): Date {
  return new Date(inicio.getTime() + dias * 24 * 60 * 60 * 1000);
}

describe("retencaoJanela", () => {
  const dataIngresso = new Date("2020-01-01T00:00:00Z");

  it("considera 1094 dias dentro da janela", () => {
    const resultado = retencaoJanela(dataIngresso, diasDepois(dataIngresso, 1094));
    expect(resultado.dentroDaJanela).toBe(true);
  });

  it("considera exatamente 1095 dias dentro da janela (limite inclusivo)", () => {
    const resultado = retencaoJanela(dataIngresso, diasDepois(dataIngresso, 1095));
    expect(resultado.dentroDaJanela).toBe(true);
  });

  it("considera 1096 dias fora da janela", () => {
    const resultado = retencaoJanela(dataIngresso, diasDepois(dataIngresso, 1096));
    expect(resultado.dentroDaJanela).toBe(false);
  });
});

describe("pesoRetencao", () => {
  it("retorna o peso pleno dentro da janela", () => {
    expect(pesoRetencao(true)).toBe(1.0);
  });

  it("retorna o peso reduzido fora da janela", () => {
    expect(pesoRetencao(false)).toBeLessThan(1.0);
  });
});
