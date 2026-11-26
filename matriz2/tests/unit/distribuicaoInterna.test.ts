import { describe, expect, it } from "vitest";
import { MATRIZ1_DO_DOCUMENTO, aplicarComplementacao } from "@/lib/mdo/propostaComplementacao";
import { distribuirUmAno, efeitoNaDistribuicao, fatorDaMatriz3, projetarDistribuicao } from "@/lib/mdo/distribuicaoInterna";

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
const nomes = Object.keys(MATRIZ1_DO_DOCUMENTO);
const campi = nomes.map((nome, i) => ({ id: i, nome, anterior: BASE_2026[nome]! }));
const somaBase = campi.reduce((s, c) => s + c.anterior, 0);

describe("distribuição interna", () => {
  it("85% em 2027 e 90% de 2028 em diante", () => {
    expect(fatorDaMatriz3(2027)).toBe(0.85);
    expect(fatorDaMatriz3(2028)).toBe(0.9);
    expect(fatorDaMatriz3(2031)).toBe(0.9);
  });

  it("em 2027 repete a proposta oficial da Reitoria, câmpus a câmpus", () => {
    const v01 = aplicarComplementacao(nomes.map((nome, i) => ({ id: i, nome, base2026: BASE_2026[nome]!, matriz1: MATRIZ1_DO_DOCUMENTO[nome]! })));
    const a = distribuirUmAno(
      campi.map((c) => ({ ...c, matriz1: MATRIZ1_DO_DOCUMENTO[c.nome]! })),
      2027,
      somaBase,
    );
    a.linhas.forEach((l, i) => expect(l.total).toBeCloseTo(v01.linhas[i]!.total, 6));
    expect(a.somaTotal).toBeCloseTo(40_408_356.11, 0);
  });

  it("encadeia os anos: o total de um ano é a base do seguinte, e o total segue o do ano anterior", () => {
    const anos = projetarDistribuicao({ anos: [2027, 2028, 2029], campi, matrizPorAno: (id) => MATRIZ1_DO_DOCUMENTO[nomes[id]!]! });
    expect(anos[0]!.fator).toBe(0.85);
    expect(anos[1]!.fator).toBe(0.9);
    expect(anos[1]!.totalDistribuido).toBeCloseTo(anos[0]!.totalDistribuido, 6);
    expect(anos[2]!.totalDistribuido).toBeCloseTo(somaBase, 6);
    anos[1]!.linhas.forEach((l, i) => expect(l.anterior).toBeCloseTo(anos[0]!.linhas[i]!.total, 6));
    for (const a of anos) for (const l of a.linhas) expect(l.total).toBeGreaterThanOrEqual(950_000);
  });

  it("usa o valor oficial quando há e muda o total e os alunos quando pedido", () => {
    const oficial = new Map(campi.map((c) => [c.id, 1_000_000 + c.id]));
    const anos = projetarDistribuicao({
      anos: [2027, 2028],
      campi,
      matrizPorAno: (id) => MATRIZ1_DO_DOCUMENTO[nomes[id]!]!,
      oficiais: new Map([[2027, oficial]]),
      totais: [null, 50_000_000],
      ajusteDeAlunos: { "0": 0.5 },
    });
    expect(anos[0]!.linhas.every((l) => l.regra === "oficial")).toBe(true);
    expect(anos[1]!.totalDistribuido).toBe(50_000_000);
    expect(anos[1]!.linhas[0]!.matriz1).toBeCloseTo(MATRIZ1_DO_DOCUMENTO[nomes[0]!]! * 1.5, 6);
  });

  it("um ganho na matriz de um câmpus muda a fatia sem mudar o total repartido", () => {
    const matriz = new Map(nomes.map((n, i) => [i, MATRIZ1_DO_DOCUMENTO[n]!]));
    const va = nomes.indexOf("CAMPUS VENÂNCIO AIRES");
    const { semGanho, comGanho } = efeitoNaDistribuicao({ anos: [2028, 2029], campi, matriz }, va, [500_000, 500_000]);
    expect(comGanho[0]!.totalDistribuido).toBeCloseTo(semGanho[0]!.totalDistribuido, 6);
    expect(comGanho[0]!.linhas[va]!.matriz2).toBeGreaterThan(semGanho[0]!.linhas[va]!.matriz2);
  });
});
