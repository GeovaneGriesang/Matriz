import { describe, expect, it } from "vitest";
import { lerListaPiso } from "@/carga/carregarExpansaoPiso";

describe("lerListaPiso", () => {
  it("lê instituicao e campus, sem acento nem diferença de caixa", () => {
    const lista = lerListaPiso("instituicao;campus;ano_criacao\nIFSUL;CAMPUS SÃO LEOPOLDO;2026\nIF BAIANO;CAMPUS RUY BARBOSA;2026\n");
    expect(lista.has("IFSUL|CAMPUSSAOLEOPOLDO")).toBe(true);
    expect(lista.has("IFBAIANO|CAMPUSRUYBARBOSA")).toBe(true);
    expect(lista.has("IFSUL|CAMPUSTRIUNFO")).toBe(false);
  });
  it("uma lista só com o cabeçalho é uma lista vazia (ninguém recebe o piso)", () => {
    expect(lerListaPiso("instituicao;campus\n").size).toBe(0);
  });
  it("recusa um CSV sem as colunas esperadas", () => {
    expect(() => lerListaPiso("a;b\n1;2\n")).toThrow();
  });
});
