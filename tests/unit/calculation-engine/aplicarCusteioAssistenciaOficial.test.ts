import { describe, it, expect } from "vitest";
import { aplicarCusteioOficial, aplicarAssistenciaOficial } from "@/calculation-engine/aplicarCusteioAssistenciaOficial";
import type { PisoMinimoCampusNovoResult } from "@/calculation-engine/aplicarPisoMinimoCampusNovo";
import type { AssistenciaEstudantilCampusResultado } from "@/calculation-engine/types/assistenciaEstudantil.types";

function funcionamento(campusId: number, valorReais: number): PisoMinimoCampusNovoResult {
  return {
    campusId,
    totalMatriculaPonderada: 0,
    share: 0,
    mtp: 0,
    valorMoocAdicional: 0,
    valorReais,
    pisoAplicado: false,
    valorAntesDoPiso: valorReais,
  };
}

function assistencia(campusId: number, instituicaoId: number, valorReais: number): AssistenciaEstudantilCampusResultado {
  return {
    campusId,
    instituicaoId,
    vrInstituicao: 0,
    mechdaInstituicao: 0,
    participacaoPonderadaInstituicao: 0,
    somaParticipacoesRede: 0,
    shareInstituicao: 0,
    valorInstituicao: 0,
    matriculaPonderadaCampus: 0,
    matriculaPonderadaInstituicao: 0,
    shareDentroInstituicao: 0,
    valorReais,
  };
}

describe("aplicarCusteioOficial", () => {
  it("escala o Funcionamento de cada câmpus para que Custeio da instituição bata com o valor oficial", () => {
    const instituicaoIdPorCampus = new Map([
      [1, 100],
      [2, 100],
    ]);
    const { funcionamento: resultado, resumoPorInstituicao } = aplicarCusteioOficial(
      [funcionamento(1, 600_000), funcionamento(2, 400_000)],
      instituicaoIdPorCampus,
      new Map([[100, 100_000]]), // Reitoria
      new Map([[100, 50_000]]), // Qualidade e Eficiência
      new Map([[100, 1_500_000]]), // Custeio oficial (maior que o calculado: 600k+400k+100k+50k = 1.150.000)
    );

    // alvoFuncionamento = 1.500.000 - 100.000 - 50.000 = 1.350.000; fator = 1.350.000 / 1.000.000 = 1,35
    const c1 = resultado.find((r) => r.campusId === 1)!;
    const c2 = resultado.find((r) => r.campusId === 2)!;
    expect(c1.valorReais).toBeCloseTo(810_000, 6);
    expect(c2.valorReais).toBeCloseTo(540_000, 6);
    expect(c1.custeioOficialAplicado).toBe(true);
    expect(c1.valorAntesDoCusteioOficial).toBe(600_000);

    // Soma final (Funcionamento escalado + Reitoria + Qualidade e Eficiência) bate exato com o oficial.
    const somaFinal = c1.valorReais + c2.valorReais + 100_000 + 50_000;
    expect(somaFinal).toBeCloseTo(1_500_000, 6);

    const resumo = resumoPorInstituicao.get(100)!;
    expect(resumo.custeioCalculado).toBe(1_150_000);
    expect(resumo.custeioOficial).toBe(1_500_000);
    // Sem base pré-trava informada — não dá pra separar complemento real de diferença de modelo.
    expect(resumo.custeioBaseOficial).toBeNull();
    expect(resumo.complementoReal).toBeNull();
    expect(resumo.diferencaCalculoBase).toBeNull();
  });

  it("com base pré-trava informada, separa complemento real (ground truth) de diferença do nosso modelo", () => {
    const { resumoPorInstituicao } = aplicarCusteioOficial(
      [funcionamento(1, 600_000), funcionamento(2, 400_000)],
      new Map([
        [1, 100],
        [2, 100],
      ]),
      new Map([[100, 100_000]]), // Reitoria
      new Map([[100, 50_000]]), // Qualidade e Eficiência — custeioCalculado = 1.150.000
      new Map([[100, 1_500_000]]), // Custeio oficial (final, com trava)
      new Map([[100, 1_300_000]]), // Custeio base oficial (CONIF, antes da trava)
    );

    const resumo = resumoPorInstituicao.get(100)!;
    expect(resumo.custeioBaseOficial).toBe(1_300_000);
    // Ground truth da planilha: 1.500.000 - 1.300.000 = 200.000 (não depende do nosso cálculo).
    expect(resumo.complementoReal).toBe(200_000);
    // Nosso cálculo (1.150.000) vs a base da CONIF (1.300.000) — imprecisão do nosso modelo, não trava.
    expect(resumo.diferencaCalculoBase).toBe(-150_000);
    // O fator de escala (dinheiro real) continua baseado em oficial/calculado, não muda com a base.
    expect(resumo.fatorEscala).toBeCloseTo((1_500_000 - 150_000) / 1_000_000, 10);
  });

  it("não altera instituições sem Custeio oficial cadastrado", () => {
    const { funcionamento: resultado } = aplicarCusteioOficial(
      [funcionamento(1, 600_000)],
      new Map([[1, 100]]),
      new Map([[100, 100_000]]),
      new Map([[100, 50_000]]),
      new Map(), // nenhum override
    );
    expect(resultado[0]?.valorReais).toBe(600_000);
    expect(resultado[0]?.custeioOficialAplicado).toBe(false);
  });

  it("não estoura em fator negativo quando o oficial é menor que Reitoria+Qualidade e Eficiência (clamp em 0)", () => {
    const { funcionamento: resultado, resumoPorInstituicao } = aplicarCusteioOficial(
      [funcionamento(1, 600_000)],
      new Map([[1, 100]]),
      new Map([[100, 100_000]]),
      new Map([[100, 50_000]]),
      new Map([[100, 100_000]]), // oficial menor que Reitoria+QE sozinhos (150.000)
    );
    expect(resultado[0]?.valorReais).toBe(0);
    expect(resumoPorInstituicao.get(100)?.fatorEscala).toBe(0);
  });
});

describe("aplicarAssistenciaOficial", () => {
  it("escala a Assistência de cada câmpus para bater com o valor oficial da instituição", () => {
    const { assistencia: resultado, resumoPorInstituicao } = aplicarAssistenciaOficial(
      [assistencia(1, 100, 60_000), assistencia(2, 100, 40_000)],
      new Map([[100, 150_000]]),
    );
    const c1 = resultado.find((r) => r.campusId === 1)!;
    const c2 = resultado.find((r) => r.campusId === 2)!;
    expect(c1.valorReais).toBeCloseTo(90_000, 6);
    expect(c2.valorReais).toBeCloseTo(60_000, 6);
    expect(c1.assistenciaOficialAplicada).toBe(true);
    expect(c1.valorAntesDaAssistenciaOficial).toBe(60_000);
    expect(c1.valorReais + c2.valorReais).toBeCloseTo(150_000, 6);

    const resumo = resumoPorInstituicao.get(100)!;
    expect(resumo.assistenciaCalculada).toBe(100_000);
    expect(resumo.assistenciaBaseOficial).toBeNull();
    expect(resumo.complementoReal).toBeNull();
    expect(resumo.diferencaCalculoBase).toBeNull();
  });

  it("com base pré-trava informada, separa complemento real de diferença do nosso modelo", () => {
    const { resumoPorInstituicao } = aplicarAssistenciaOficial(
      [assistencia(1, 100, 60_000), assistencia(2, 100, 40_000)],
      new Map([[100, 150_000]]), // oficial (final, com trava)
      new Map([[100, 120_000]]), // base oficial (CONIF, antes da trava)
    );
    const resumo = resumoPorInstituicao.get(100)!;
    expect(resumo.assistenciaBaseOficial).toBe(120_000);
    expect(resumo.complementoReal).toBe(30_000); // 150.000 - 120.000, ground truth da planilha
    expect(resumo.diferencaCalculoBase).toBe(-20_000); // 100.000 (nosso calculo) - 120.000
  });

  it("não altera instituições sem Assistência oficial cadastrada", () => {
    const { assistencia: resultado } = aplicarAssistenciaOficial(
      [assistencia(1, 100, 60_000)],
      new Map(),
    );
    expect(resultado[0]?.valorReais).toBe(60_000);
    expect(resultado[0]?.assistenciaOficialAplicada).toBe(false);
  });
});
