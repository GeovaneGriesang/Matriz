import { describe, expect, it } from "vitest";
import { explicarVariacao, type CicloParaExplicar } from "@/lib/mdo/explicarVariacao";

function ciclo(ano: number, sobrescreve: Partial<CicloParaExplicar> = {}): CicloParaExplicar {
  return {
    ano,
    mt: { presencial: 1000, ead: 200, eadMooc: 50, eadFp: 100 },
    valorMatricula: { presencial: 1000, ead: 250, eadMooc: 800, eadFp: 800 },
    final: 0,
    fundoRede: 1_500_000_000,
    ...sobrescreve,
  };
}

function comFinal(c: CicloParaExplicar, piso = 0): CicloParaExplicar {
  const calc = (["presencial", "ead", "eadMooc", "eadFp"] as const).reduce((s, m) => s + c.mt[m] * c.valorMatricula[m], 0);
  return { ...c, final: Math.max(calc, piso) };
}

describe("explicar a variação do valor da matriz de um câmpus", () => {
  it("os quatro efeitos somam exatamente a diferença", () => {
    const a = comFinal(ciclo(2026));
    const b = comFinal(
      ciclo(2027, {
        mt: { presencial: 1100, ead: 180, eadMooc: 70, eadFp: 100 },
        valorMatricula: { presencial: 1100, ead: 275, eadMooc: 880, eadFp: 880 },
        fundoRede: 1_800_000_000,
      }),
    );
    const e = explicarVariacao(a, b)!;
    expect(e.diferenca).toBeCloseTo(b.final - a.final, 6);
    expect(e.resto).toBeCloseTo(0, 4);
  });

  it("mais alunos com o mesmo valor: só efeito de matrícula", () => {
    const a = comFinal(ciclo(2026));
    const b = comFinal(ciclo(2027, { mt: { presencial: 1200, ead: 200, eadMooc: 50, eadFp: 100 } }));
    const e = explicarVariacao(a, b)!;
    expect(e.efeitoMatricula).toBeCloseTo(200 * 1000, 6);
    expect(e.efeitoOrcamento).toBeCloseTo(0, 6);
    expect(e.efeitoMatriculaRede).toBeCloseTo(0, 6);
    expect(e.efeitoPiso).toBeCloseTo(0, 6);
  });

  it("orçamento maior com a mesma matrícula na rede sobe o valor da matrícula", () => {
    const a = comFinal(ciclo(2026));
    // O fundo cresce 10% e a matrícula da rede (fundo ÷ valor) se mantém: o valor sobe 10%.
    const b = comFinal(
      ciclo(2027, {
        fundoRede: 1_650_000_000,
        valorMatricula: { presencial: 1100, ead: 275, eadMooc: 880, eadFp: 880 },
      }),
    );
    const e = explicarVariacao(a, b)!;
    expect(e.efeitoOrcamento).toBeGreaterThan(0);
    expect(e.efeitoMatriculaRede).toBeCloseTo(0, 4);
    expect(e.resto).toBeCloseTo(0, 4);
  });

  it("mais matrícula na rede dilui o valor e aparece como efeito próprio", () => {
    const a = comFinal(ciclo(2026));
    // Mesmo fundo, valor da matrícula caiu 5%: a rede ganhou matrícula.
    const b = comFinal(ciclo(2027, { valorMatricula: { presencial: 950, ead: 237.5, eadMooc: 760, eadFp: 760 } }));
    const e = explicarVariacao(a, b)!;
    expect(e.efeitoOrcamento).toBeCloseTo(0, 4);
    expect(e.efeitoMatriculaRede).toBeLessThan(0);
    expect(e.matriculaRedeB).toBeGreaterThan(e.matriculaRedeA);
  });

  it("o piso aparece quando o câmpus é elevado a ele em um dos ciclos", () => {
    const a = comFinal(ciclo(2026, { mt: { presencial: 100, ead: 0, eadMooc: 0, eadFp: 0 } }));
    const b = comFinal(ciclo(2027, { mt: { presencial: 100, ead: 0, eadMooc: 0, eadFp: 0 } }), 700_000);
    const e = explicarVariacao(a, b)!;
    expect(e.efeitoPiso).toBeCloseTo(700_000 - 100_000, 6);
    expect(e.resto).toBeCloseTo(0, 4);
  });

  it("sem valor de matrícula em um dos ciclos, não explica", () => {
    const a = ciclo(2026, { valorMatricula: { presencial: 0, ead: 0, eadMooc: 0, eadFp: 0 } });
    expect(explicarVariacao(a, ciclo(2027))).toBeNull();
  });
});
