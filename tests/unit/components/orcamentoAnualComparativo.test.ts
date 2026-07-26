import { describe, it, expect } from "vitest";
import { calcularBlocosRede, simularCongelamentoReitoria, type OrcamentoAnual } from "@/components/admin/OrcamentoAnualPanel";

function orcamento(overrides: Partial<OrcamentoAnual> & Pick<OrcamentoAnual, "ano" | "valorTotal" | "valorAssistenciaEstudantil">): OrcamentoAnual {
  return {
    percentualAnuidade: 0.15,
    pisoMinimoCampusNovo: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calcularBlocosRede", () => {
  it("isola o total da Ação 20RL (Funcionamento+Reitoria+Qualidade) do total da Ação 2994 (Assistência)", () => {
    const o = orcamento({ ano: 2026, valorTotal: 100_000_000, valorAssistenciaEstudantil: 10_000_000 });
    const blocos = calcularBlocosRede(o);

    expect(blocos.bloco1Matriculas).toBe(80_000_000);
    expect(blocos.bloco1Reitoria).toBe(10_000_000);
    expect(blocos.bloco1Subtotal).toBe(90_000_000);
    expect(blocos.bloco2).toBe(10_000_000);
    expect(blocos.acao20RL).toBe(100_000_000);
    expect(blocos.bloco3).toBe(10_000_000);
    expect(blocos.totalGeral).toBe(blocos.acao20RL + blocos.bloco3);
    expect(blocos.totalGeral).toBe(110_000_000);
  });
});

describe("simularCongelamentoReitoria", () => {
  const anoAnterior = orcamento({ ano: 2025, valorTotal: 100_000_000, valorAssistenciaEstudantil: 10_000_000 });
  const anoAtual = orcamento({ ano: 2026, valorTotal: 120_000_000, valorAssistenciaEstudantil: 12_000_000 });

  it("fixa a Reitoria do Ano Atual no valor do Ano Anterior e devolve a diferença ao Bloco Matrículas/Campi", () => {
    const oficial = calcularBlocosRede(anoAtual);
    const simulado = simularCongelamentoReitoria(anoAnterior, anoAtual);

    expect(simulado.bloco1Reitoria).toBe(calcularBlocosRede(anoAnterior).bloco1Reitoria);
    expect(simulado.bloco1Reitoria).toBe(10_000_000);

    const deltaReitoria = oficial.bloco1Reitoria - simulado.bloco1Reitoria;
    expect(simulado.bloco1Matriculas).toBe(oficial.bloco1Matriculas + deltaReitoria);
    expect(simulado.bloco1Matriculas).toBe(98_000_000);
  });

  it("não altera Bloco Qualidade, Ação 2994, Total Ação 20RL nem Total Geral — só a repartição Reitoria/Matrículas", () => {
    const oficial = calcularBlocosRede(anoAtual);
    const simulado = simularCongelamentoReitoria(anoAnterior, anoAtual);

    expect(simulado.bloco2).toBe(oficial.bloco2);
    expect(simulado.bloco3).toBe(oficial.bloco3);
    expect(simulado.acao20RL).toBe(oficial.acao20RL);
    expect(simulado.totalGeral).toBe(oficial.totalGeral);
    expect(simulado.bloco1Matriculas + simulado.bloco1Reitoria).toBe(oficial.bloco1Subtotal);
  });
});
