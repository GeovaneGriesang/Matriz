import { describe, expect, it } from "vitest";
import {
  distribuirAno,
  planoLinear,
  planoValido,
  simularTransicao,
  type CampusDistribuicao,
} from "@/lib/mdo/transicaoDistribuicao";

const campi: CampusDistribuicao[] = [
  { id: 1, nome: "A", informado: 6_000_000, matriz: 4_000_000, indice: 1.2 },
  { id: 2, nome: "B", informado: 3_000_000, matriz: 4_000_000, indice: 0.8 },
  { id: 3, nome: "C", informado: 1_000_000, matriz: 2_000_000, indice: 1 },
];
const total = 10_000_000;

describe("plano de transição", () => {
  it("desce em linha reta e termina na matriz pura", () => {
    const plano = planoLinear(80, 0.5, 3);
    expect(plano.map((p) => p.mantidoPct)).toEqual([80, 40, 0]);
    expect(plano[0]!.indicePct).toBeCloseTo(10, 9); // (100 - 80) * 0,5
    expect(plano[1]!.indicePct).toBeCloseTo(15, 9); // (100 - 40) * 0,5 * 0,5
    expect(plano[2]).toEqual({ mantidoPct: 0, indicePct: 0 });
  });

  it("um plano de um ano só é a matriz pura", () => {
    expect(planoLinear(80, 1, 1)).toEqual([{ mantidoPct: 0, indicePct: 0 }]);
  });

  it("rejeita percentuais que passam de 100", () => {
    expect(planoValido({ mantidoPct: 70, indicePct: 40 })).toBe(false);
    expect(planoValido({ mantidoPct: 70, indicePct: 30 })).toBe(true);
  });
});

describe("distribuição de um ano", () => {
  it("100% mantido reproduz as fatias do informado", () => {
    const r = distribuirAno(campi, total, { mantidoPct: 100, indicePct: 0 });
    expect(r.valores).toEqual([6_000_000, 3_000_000, 1_000_000]);
  });

  it("100% matriz reproduz as fatias da matriz", () => {
    const r = distribuirAno(campi, total, { mantidoPct: 0, indicePct: 0 });
    expect(r.valores[0]).toBeCloseTo(4_000_000, 6);
    expect(r.valores[2]).toBeCloseTo(2_000_000, 6);
  });

  it("o índice desloca dinheiro para o câmpus de melhor desempenho", () => {
    const semIndice = distribuirAno(campi, total, { mantidoPct: 0, indicePct: 0 });
    const comIndice = distribuirAno(campi, total, { mantidoPct: 0, indicePct: 100 });
    expect(comIndice.valores[0]).toBeGreaterThan(semIndice.valores[0]!);
    expect(comIndice.valores[1]).toBeLessThan(semIndice.valores[1]!);
  });

  it("a soma dos câmpus é sempre o total, em qualquer plano", () => {
    for (const plano of [
      { mantidoPct: 80, indicePct: 10 },
      { mantidoPct: 33.3, indicePct: 41.1 },
      { mantidoPct: 0, indicePct: 100 },
    ]) {
      const soma = distribuirAno(campi, total, plano).valores.reduce((s, v) => s + v, 0);
      expect(soma).toBeCloseTo(total, 6);
    }
  });

  it("sem valor informado, a parte mantida cai na matriz em vez de sumir", () => {
    const semHistorico = campi.map((c) => ({ ...c, informado: 0 }));
    const r = distribuirAno(semHistorico, total, { mantidoPct: 80, indicePct: 0 });
    expect(r.valores.reduce((s, v) => s + v, 0)).toBeCloseTo(total, 6);
    expect(r.valores[0]).toBeCloseTo(4_000_000, 6);
  });

  it("recusa um plano que passa de 100%", () => {
    expect(() => distribuirAno(campi, total, { mantidoPct: 80, indicePct: 40 })).toThrow();
  });
});

describe("transição de três anos", () => {
  it("vai do informado à matriz, e o último ano é a matriz pura", () => {
    const r = simularTransicao(campi, [total, total, total], planoLinear(80, 0.5, 3));
    expect(r.anos).toHaveLength(3);
    r.somaPorAno.forEach((s) => expect(s).toBeCloseTo(total, 6));
    // O câmpus A recebia 60% e a matriz dá 40%: desce a cada ano, sem cair de uma vez.
    const a = r.anos.map((ano) => ano.valores[0]!);
    expect(a[0]).toBeGreaterThan(a[1]!);
    expect(a[1]).toBeGreaterThan(a[2]!);
    expect(a[2]).toBeCloseTo(4_000_000, 6);
    // O câmpus C recebia 10% e a matriz dá 20%: sobe a cada ano.
    const c = r.anos.map((ano) => ano.valores[2]!);
    expect(c[0]).toBeLessThan(c[1]!);
    expect(c[1]).toBeLessThan(c[2]!);
  });
});
