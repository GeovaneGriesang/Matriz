import { describe, it, expect } from "vitest";
import { tecnicoIntegradoMinimo } from "@/calculation-engine/alunoMatriz/tecnicoIntegradoMinimo";

describe("tecnicoIntegradoMinimo", () => {
  it("aplica o piso de 1.5 quando o peso computado é menor para Técnico Integrado", () => {
    expect(tecnicoIntegradoMinimo("TECNICO_INTEGRADO", 1.0)).toBe(1.5);
  });

  it("mantém o peso computado quando já está acima do piso para Técnico Integrado", () => {
    expect(tecnicoIntegradoMinimo("TECNICO_INTEGRADO", 2.0)).toBe(2.0);
  });

  it("nunca aplica o piso a cursos que não são Técnico Integrado", () => {
    expect(tecnicoIntegradoMinimo("TECNICO_SUBSEQUENTE", 1.0)).toBe(1.0);
  });
});
