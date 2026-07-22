import { describe, it, expect } from "vitest";
import { calcularMatriculaPonderada } from "@/calculation-engine/alunoMatriz/calcularMatriculaPonderada";
import type { MatriculaPonderadaInput } from "@/calculation-engine/types/alunoMatriz.types";

const dataReferencia = new Date("2024-01-01T00:00:00Z");
const dataIngressoDentroDaJanela = new Date("2023-06-01T00:00:00Z");

function baseInput(overrides: Partial<MatriculaPonderadaInput> = {}): MatriculaPonderadaInput {
  return {
    matriculaEquivalente: 10,
    modalidade: "PRESENCIAL",
    nivel: "TECNICO_SUBSEQUENTE",
    eixoAgricola: false,
    labInfraTier: 1,
    dataIngressoCiclo: dataIngressoDentroDaJanela,
    dataReferencia,
    ...overrides,
  };
}

describe("calcularMatriculaPonderada", () => {
  it("EAD Próprio + eixo agrícola + lab tier 3, dentro da janela de retenção", () => {
    const resultado = calcularMatriculaPonderada(
      baseInput({ modalidade: "EAD_PROPRIO", eixoAgricola: true, labInfraTier: 3 }),
    );
    // 10 * 0.80 (EAD próprio) * 2.0 (lab tier 3) * 1.5 (agrícola) * 1.0 (retenção) = 24
    expect(resultado.matriculaPonderada).toBeCloseTo(24, 6);
    expect(resultado.strictoSensuAplicado).toBe(false);
    expect(resultado.dentroDaJanelaRetencao).toBe(true);
  });

  it("Técnico Integrado com peso computado abaixo do piso aplica o piso de 1.5", () => {
    const resultado = calcularMatriculaPonderada(
      baseInput({ nivel: "TECNICO_INTEGRADO", modalidade: "EAD_FOMENTO_EXTERNO", labInfraTier: 1 }),
    );
    // peso computado = 0.25 * 1.0 = 0.25, piso força para 1.5 -> 10 * 1.5 = 15
    expect(resultado.matriculaPonderada).toBeCloseTo(15, 6);
  });

  it("Stricto Sensu (mestrado) ignora modalidade/lab/eixo e aplica só o fator 3.75", () => {
    const resultado = calcularMatriculaPonderada(
      baseInput({
        nivel: "MESTRADO",
        modalidade: "EAD_FOMENTO_EXTERNO",
        eixoAgricola: true,
        labInfraTier: 4,
      }),
    );
    // 10 * 3.75 * 1.0 (retenção) = 37.5 — nenhum outro peso aplicado
    expect(resultado.matriculaPonderada).toBeCloseTo(37.5, 6);
    expect(resultado.strictoSensuAplicado).toBe(true);
  });

  it("aplica o peso reduzido de retenção quando fora da janela de 1095 dias", () => {
    const dataIngressoForaDaJanela = new Date("2019-01-01T00:00:00Z");
    const resultado = calcularMatriculaPonderada(
      baseInput({ dataIngressoCiclo: dataIngressoForaDaJanela }),
    );
    expect(resultado.dentroDaJanelaRetencao).toBe(false);
    expect(resultado.matriculaPonderada).toBeLessThan(10);
  });
});
