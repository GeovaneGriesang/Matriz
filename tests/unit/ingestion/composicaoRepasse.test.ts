import { describe, it, expect } from "vitest";
import {
  normalizarCategoriaRepasse,
  normalizarPesoRepasse,
} from "@/server/composicaoRepasse/normalizacao";

describe("normalizarCategoriaRepasse", () => {
  it("reconhece as quatro categorias como vêm na planilha da CONIF", () => {
    expect(normalizarCategoriaRepasse("PRESENCIAL")).toBe("PRESENCIAL");
    expect(normalizarCategoriaRepasse("EAD")).toBe("EAD");
    expect(normalizarCategoriaRepasse("EAD MOOC")).toBe("EAD_MOOC");
    expect(normalizarCategoriaRepasse("EAD FP")).toBe("EAD_FP");
  });

  it("tolera caixa, acento e separador (exportações para CSV variam)", () => {
    expect(normalizarCategoriaRepasse("presencial")).toBe("PRESENCIAL");
    expect(normalizarCategoriaRepasse("Ead_Mooc")).toBe("EAD_MOOC");
    expect(normalizarCategoriaRepasse("ead-fp")).toBe("EAD_FP");
    expect(normalizarCategoriaRepasse("  EAD   MOOC  ")).toBe("EAD_MOOC");
  });

  it("devolve null para categoria desconhecida em vez de adivinhar", () => {
    expect(normalizarCategoriaRepasse("SEMIPRESENCIAL")).toBeNull();
    expect(normalizarCategoriaRepasse("")).toBeNull();
  });
});

describe("normalizarPesoRepasse", () => {
  it("aceita a fração publicada pela CONIF", () => {
    expect(normalizarPesoRepasse("1")).toBe(1);
    expect(normalizarPesoRepasse("0.8")).toBe(0.8);
    expect(normalizarPesoRepasse("0.25")).toBe(0.25);
    expect(normalizarPesoRepasse("0.08")).toBe(0.08);
  });

  it("aceita vírgula decimal (padrão brasileiro)", () => {
    expect(normalizarPesoRepasse("0,25")).toBe(0.25);
    expect(normalizarPesoRepasse("0,08")).toBe(0.08);
  });

  it("aceita percentual explícito", () => {
    expect(normalizarPesoRepasse("25%")).toBe(0.25);
    expect(normalizarPesoRepasse("8%")).toBe(0.08);
    expect(normalizarPesoRepasse("100%")).toBe(1);
  });

  it("trata número acima de 1 sem %% como percentual (Excel multiplicando por 100)", () => {
    expect(normalizarPesoRepasse("80")).toBe(0.8);
    expect(normalizarPesoRepasse("25")).toBe(0.25);
  });

  it("NÃO confunde 0.25 com 25 — o ponto só é milhar quando há vírgula decimal", () => {
    expect(normalizarPesoRepasse("0.25")).toBe(0.25);
    expect(normalizarPesoRepasse("0.08")).toBe(0.08);
  });

  it("recusa valores impossíveis em vez de gravar peso errado silenciosamente", () => {
    expect(normalizarPesoRepasse("")).toBeNull();
    expect(normalizarPesoRepasse("abc")).toBeNull();
    expect(normalizarPesoRepasse("-1")).toBeNull();
    expect(normalizarPesoRepasse("101")).toBeNull();
  });

  it("distingue o peso de 2026 do de 2027 para o EAD MOOC (0,8 vs 0,08)", () => {
    // A mudança que motivou guardar os pesos por ano: um é dez vezes o outro.
    expect(normalizarPesoRepasse("0,8")).toBe(0.8);
    expect(normalizarPesoRepasse("0,08")).toBe(0.08);
    expect(normalizarPesoRepasse("0,8")).not.toBe(normalizarPesoRepasse("0,08"));
  });
});
