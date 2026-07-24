import { describe, it, expect } from "vitest";
import { calcularAnuidadeConif } from "@/calculation-engine/anuidadeConif";

describe("calcularAnuidadeConif", () => {
  it("calcula a anuidade de cada instituição como percentual sobre seu próprio Custeio", () => {
    const resultado = calcularAnuidadeConif(
      [
        { instituicaoId: 187, custeioInstituicao: 40_000_000 },
        { instituicaoId: 181, custeioInstituicao: 10_000_000 },
      ],
      2, // 2%
    );

    const porId = new Map(resultado.map((r) => [r.instituicaoId, r]));
    expect(porId.get(187)?.valorReais).toBeCloseTo(800_000, 6);
    expect(porId.get(181)?.valorReais).toBeCloseTo(200_000, 6);
  });

  it("retorna valor zero quando o percentual é zero", () => {
    const resultado = calcularAnuidadeConif([{ instituicaoId: 1, custeioInstituicao: 5_000_000 }], 0);
    expect(resultado[0]?.valorReais).toBe(0);
  });

  it("retorna lista vazia quando não há inputs", () => {
    expect(calcularAnuidadeConif([], 2)).toEqual([]);
  });

  it("não depende de um total de rede — cada instituição usa só o próprio Custeio", () => {
    const resultado = calcularAnuidadeConif(
      [
        { instituicaoId: 1, custeioInstituicao: 1_000_000 },
        { instituicaoId: 2, custeioInstituicao: 3_000_000 },
      ],
      5,
    );
    const porId = new Map(resultado.map((r) => [r.instituicaoId, r]));
    expect(porId.get(1)?.valorReais).toBeCloseTo(50_000, 6);
    expect(porId.get(2)?.valorReais).toBeCloseTo(150_000, 6);
  });
});
