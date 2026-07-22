import { describe, it, expect } from "vitest";
import { modalidadeWeight } from "@/calculation-engine/alunoMatriz/modalidadeWeight";

describe("modalidadeWeight", () => {
  it("retorna 1.00 para Presencial", () => {
    expect(modalidadeWeight("PRESENCIAL")).toBe(1.0);
  });

  it("retorna 0.80 para EAD Próprio", () => {
    expect(modalidadeWeight("EAD_PROPRIO")).toBe(0.8);
  });

  it("retorna 0.25 para EAD Fomento Externo", () => {
    expect(modalidadeWeight("EAD_FOMENTO_EXTERNO")).toBe(0.25);
  });

  it("lança erro para modalidade não reconhecida", () => {
    // @ts-expect-error valor inválido propositalmente para testar o guard
    expect(() => modalidadeWeight("INVALIDA")).toThrow();
  });
});
