import { describe, expect, it } from "vitest";
import { aplicarComplementacao, MATRIZ1_DO_DOCUMENTO } from "@/lib/mdo/propostaComplementacao";

/** O recebido em 2026 (pág. 6 do documento), igual ao cadastrado em Valores recebidos. */
const BASE_2026: Record<string, number> = {
  "CAMPUS BAGÉ": 2_180_644.29,
  "CAMPUS CAMAQUÃ": 1_947_281.85,
  "CAMPUS CHARQUEADAS": 2_740_569.11,
  "CAMPUS GRAVATAÍ": 1_326_758.57,
  "CAMPUS JAGUARÃO": 793_730.65,
  "CAMPUS LAJEADO": 1_236_867.78,
  "CAMPUS NOVO HAMBURGO": 716_815.53,
  "CAMPUS PASSO FUNDO": 2_517_199.58,
  "CAMPUS PELOTAS": 12_012_047.09,
  "CAMPUS PELOTAS VISCONDE DA GRAÇA": 6_098_456.83,
  "CAMPUS SANTANA DO LIVRAMENTO": 2_010_704.49,
  "CAMPUS SAPIRANGA": 1_417_090.19,
  "CAMPUS SAPUCAIA DO SUL": 3_460_022.11,
  "CAMPUS VENÂNCIO AIRES": 1_946_728.63,
};

/** Total proposto 2027 (pág. 6). */
const TOTAL_DO_DOCUMENTO: Record<string, number> = {
  "CAMPUS BAGÉ": 2_180_644.29,
  "CAMPUS CAMAQUÃ": 1_947_281.85,
  "CAMPUS CHARQUEADAS": 2_740_569.11,
  "CAMPUS GRAVATAÍ": 1_326_758.57,
  "CAMPUS JAGUARÃO": 950_000,
  "CAMPUS LAJEADO": 1_314_050.0,
  "CAMPUS NOVO HAMBURGO": 950_000,
  "CAMPUS PASSO FUNDO": 2_517_199.58,
  "CAMPUS PELOTAS": 11_291_324.26,
  "CAMPUS PELOTAS VISCONDE DA GRAÇA": 5_732_549.42,
  "CAMPUS SANTANA DO LIVRAMENTO": 2_585_795.88,
  "CAMPUS SAPIRANGA": 1_417_090.19,
  "CAMPUS SAPUCAIA DO SUL": 3_508_364.34,
  "CAMPUS VENÂNCIO AIRES": 1_946_728.63,
};

describe("Proposta versão 01: reproduz as tabelas do documento", () => {
  const r = aplicarComplementacao(Object.keys(MATRIZ1_DO_DOCUMENTO).map((nome, i) => ({ id: i, nome, base2026: BASE_2026[nome]!, matriz1: MATRIZ1_DO_DOCUMENTO[nome]! })));

  it("cada câmpus chega ao total proposto, ao centavo", () => {
    for (const l of r.linhas) expect(l.total, l.nome).toBeCloseTo(TOTAL_DO_DOCUMENTO[l.nome]!, 1);
  });

  it("somas da pág. 6 e a diferença para a reserva de 15%", () => {
    expect(r.somaMatriz1).toBeCloseTo(34_438_076.33, 1);
    expect(r.somaBase).toBeCloseTo(40_404_916.7, 1);
    expect(r.somaMatriz3).toBeCloseTo(34_344_179.2, 0);
    expect(r.somaComplemento).toBeCloseTo(6_064_176.92, 0);
    expect(r.somaTotal).toBeCloseTo(40_408_356.11, 0);
    expect(r.somaComplemento - r.reserva).toBeCloseTo(3_439.41, 0);
  });

  it("aplica a regra certa em cada caso", () => {
    const regra = (nome: string) => r.linhas.find((l) => l.nome === nome)!.regra;
    expect(regra("CAMPUS LAJEADO")).toBe("acima-de-2026");
    expect(regra("CAMPUS VENÂNCIO AIRES")).toBe("integral");
    expect(regra("CAMPUS PELOTAS")).toBe("ate-94");
    expect(regra("CAMPUS JAGUARÃO")).toBe("piso");
  });
});
