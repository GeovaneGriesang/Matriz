import { describe, expect, it } from "vitest";
import {
  alunosContadosPelaMdo,
  chMatrizPorRegra,
  chaveDoPesoEfetivo,
  dataDeJubilamento,
  pesoEfetivoDoFic,
  prazoDeJubilamentoEmDias,
} from "@/lib/mdo/regrasCiclo";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("regras do ciclo derivadas da PNP", () => {
  it("o prazo de jubilamento é de 3 anos, e zero na qualificação profissional", () => {
    expect(prazoDeJubilamentoEmDias("TECNICO")).toBe(1095);
    expect(prazoDeJubilamentoEmDias("BACHARELADO")).toBe(1095);
    expect(prazoDeJubilamentoEmDias("QUALIFICACAO PROFISSIONAL (FIC)")).toBe(0);
    expect(prazoDeJubilamentoEmDias("Qualificação Profissional (FIC)")).toBe(0);
    // Exemplo real da 6ª fase: término 21/12/2028, jubilamento 21/12/2031.
    expect(dataDeJubilamento(dia("2028-12-21"), "TECNICO").toISOString().slice(0, 10)).toBe("2031-12-21");
  });

  it("a MDO só conta os alunos de ciclos não jubilados no início do período", () => {
    const inicio = dia("2025-01-01");
    expect(alunosContadosPelaMdo(91, dia("2024-12-09"), inicio)).toBe(0);
    expect(alunosContadosPelaMdo(91, dia("2025-01-01"), inicio)).toBe(91);
    expect(alunosContadosPelaMdo(91, dia("2027-06-30"), inicio)).toBe(91);
  });

  it("a carga horária da matriz segue o tipo e a oferta do curso", () => {
    expect(chMatrizPorRegra("QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA", 180, 3200)).toBe(180);
    expect(chMatrizPorRegra("DOUTORADO", "NÃO SE APLICA", 720, 460)).toBe(720);
    expect(chMatrizPorRegra("TECNICO", "PROEJA - INTEGRADO", 2460, 1200)).toBe(2400);
    expect(chMatrizPorRegra("TECNICO", "INTEGRADO", 3750, 800)).toBe(3000);
    expect(chMatrizPorRegra("TECNICO", "INTEGRADO", 3750, 1000)).toBe(3100);
    expect(chMatrizPorRegra("TECNICO", "INTEGRADO", 3750, 1200)).toBe(3200);
    expect(chMatrizPorRegra("TECNICO", "SUBSEQUENTE", 1250, 1200)).toBe(1200);
    expect(chMatrizPorRegra("BACHARELADO", "NÃO SE APLICA", 4280, 3200)).toBe(3200);
  });

  it("o FIC fora do catálogo (mínima de 3.200 h) vale peso 2,5", () => {
    expect(pesoEfetivoDoFic(3200)).toBe(2.5);
    expect(pesoEfetivoDoFic(160)).toBeNull();
  });

  it("a chave do peso efetivo inclui a carga horária mínima", () => {
    const a = chaveDoPesoEfetivo("TECNICO", "INTEGRADO", "TECNICO EM INFORMATICA", 1200);
    const b = chaveDoPesoEfetivo("TECNICO", "INTEGRADO", "TECNICO EM INFORMATICA", 800);
    expect(a).not.toBe(b);
  });
});
