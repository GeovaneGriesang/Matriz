import { describe, expect, it } from "vitest";
import { nomeCanonicoDaUnidade } from "@/lib/nomesDeUnidade";

describe("nomeCanonicoDaUnidade", () => {
  it("troca o nome antigo do Novo Hamburgo pelo atual, em qualquer caixa", () => {
    expect(nomeCanonicoDaUnidade("CAMPUS AVANÇADO NOVO HAMBURGO")).toBe("CAMPUS NOVO HAMBURGO");
    expect(nomeCanonicoDaUnidade(" Campus Avançado Novo Hamburgo ")).toBe("CAMPUS NOVO HAMBURGO");
  });
  it("deixa os outros nomes como estavam", () => {
    expect(nomeCanonicoDaUnidade("CAMPUS AVANÇADO ROSÁRIO")).toBe("CAMPUS AVANÇADO ROSÁRIO");
    expect(nomeCanonicoDaUnidade("CAMPUS BAGÉ")).toBe("CAMPUS BAGÉ");
  });
});
