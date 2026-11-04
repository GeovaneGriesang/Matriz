import { describe, expect, it } from "vitest";
import { anoBaseDoCiclo, explicacaoDasTurmasRetidas, turmaEncerradaAntesDoAnoBase } from "@/lib/turmasRetidas";

describe("turmas encerradas antes do ano-base", () => {
  it("o ano-base é dois anos antes do ciclo", () => {
    expect(anoBaseDoCiclo(2027)).toBe(2025);
  });

  it("terminou antes de 2025: é retida na matriz de 2027", () => {
    expect(turmaEncerradaAntesDoAnoBase("2024-12-20T00:00:00.000Z", 2027)).toBe(true);
    expect(turmaEncerradaAntesDoAnoBase("2024-12-31T23:59:59.000Z", 2027)).toBe(true);
  });

  it("termina em qualquer dia do ano-base ou depois: pega o ano de referência", () => {
    expect(turmaEncerradaAntesDoAnoBase("2025-01-01T00:00:00.000Z", 2027)).toBe(false);
    expect(turmaEncerradaAntesDoAnoBase("2028-12-21T00:00:00.000Z", 2027)).toBe(false);
  });

  it("a mesma turma muda de grupo conforme o ciclo", () => {
    const termino = "2024-12-20T00:00:00.000Z";
    expect(turmaEncerradaAntesDoAnoBase(termino, 2026)).toBe(false);
    expect(turmaEncerradaAntesDoAnoBase(termino, 2027)).toBe(true);
  });

  it("sem data de término, fica com as demais", () => {
    expect(turmaEncerradaAntesDoAnoBase(null, 2027)).toBe(false);
  });

  it("a explicação cita o ano-base do ciclo", () => {
    expect(explicacaoDasTurmasRetidas(2027)).toContain("Terminaram antes de 2025");
  });
});
