import { describe, expect, it } from "vitest";
import { nivelDaTela } from "@/lib/confianca";

describe("o selo único de cada tela", () => {
  it("mostra o nível de menor certeza: atenção, depois estimado, depois conferido", () => {
    expect(nivelDaTela(["CONFERIDO", "ESTIMADO", "ATENCAO"])).toBe("ATENCAO");
    expect(nivelDaTela(["CONFERIDO", "ESTIMADO"])).toBe("ESTIMADO");
    expect(nivelDaTela(["CONFERIDO", "CONFERIDO"])).toBe("CONFERIDO");
  });
});
