import { describe, it, expect } from "vitest";
import { eixoAgricolaBonus } from "@/calculation-engine/alunoMatriz/eixoAgricolaBonus";

describe("eixoAgricolaBonus", () => {
  it("aplica o fator 1.5 exatamente quando o eixo é agrícola", () => {
    expect(eixoAgricolaBonus(true, 1.0)).toBe(1.5);
  });

  it("mantém o peso base inalterado quando o eixo não é agrícola", () => {
    expect(eixoAgricolaBonus(false, 1.0)).toBe(1.0);
  });

  it("aplica o bônus sobre um peso base diferente de 1.0", () => {
    expect(eixoAgricolaBonus(true, 2.0)).toBe(3.0);
  });
});
