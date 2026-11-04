import { describe, expect, it } from "vitest";
import { periodoCurtoDoCiclo, rotuloDoCiclo } from "@/lib/identificacaoCiclo";

describe("identificação do ciclo", () => {
  it("escreve o código e o período, sem recuar o mês por causa do fuso", () => {
    expect(rotuloDoCiclo({ codigoCiclo: "2986225", inicio: "2025-03-01T00:00:00.000Z", termino: "2028-12-31T00:00:00.000Z" })).toBe("turma 2986225, 03/2025 a 12/2028");
  });

  it("aceita data como objeto e fica só com o período quando não há código", () => {
    expect(rotuloDoCiclo({ inicio: new Date(Date.UTC(2023, 0, 1)), termino: new Date(Date.UTC(2026, 1, 28)) })).toBe("01/2023 a 02/2026");
  });

  it("diz quando falta o término ou não há data nenhuma", () => {
    expect(periodoCurtoDoCiclo({ inicio: "2024-08-01T00:00:00.000Z", termino: null })).toBe("início em 08/2024");
    expect(rotuloDoCiclo({ codigoCiclo: "7", inicio: null, termino: null })).toBe("turma 7, sem data");
  });
});
