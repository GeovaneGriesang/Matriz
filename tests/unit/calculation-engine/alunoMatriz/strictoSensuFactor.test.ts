import { describe, it, expect } from "vitest";
import { strictoSensuFactor, isStrictoSensu } from "@/calculation-engine/alunoMatriz/strictoSensuFactor";
import type { NivelCurso } from "@/calculation-engine/types/alunoMatriz.types";

describe("strictoSensuFactor", () => {
  it.each(["MESTRADO", "DOUTORADO"] as const)("retorna 3.75 para %s", (nivel) => {
    expect(strictoSensuFactor(nivel)).toBe(3.75);
    expect(isStrictoSensu(nivel)).toBe(true);
  });

  it.each([
    "TECNICO_INTEGRADO",
    "TECNICO_CONCOMITANTE",
    "TECNICO_SUBSEQUENTE",
    "GRADUACAO",
    "ESPECIALIZACAO",
  ] as NivelCurso[])("retorna 1 (no-op) para %s", (nivel) => {
    expect(strictoSensuFactor(nivel)).toBe(1);
    expect(isStrictoSensu(nivel)).toBe(false);
  });
});
