import { describe, expect, it } from "vitest";
import { matrizesProjetadas, PROPOSTAS_DE_TRANSICAO, transicaoDoCampus } from "@/lib/mdo/transicaoCumulativa";

describe("transição cumulativa da proposta do Câmpus Sapucaia do Sul", () => {
  // O exemplo do próprio documento: Câmpus Sapucaia do Sul, com a matriz igual nos três anos.
  const anos = transicaoDoCampus(3460022.11, [4057568.49, 4057568.49, 4057568.49]);

  it("reproduz a tabela do documento, ao centavo", () => {
    expect(anos[0]!.acrescimo).toBeCloseTo(197190.31, 2);
    expect(anos[0]!.valor).toBeCloseTo(3657212.42, 2);
    expect(anos[1]!.acrescimo).toBeCloseTo(264235.01, 2);
    expect(anos[1]!.valor).toBeCloseTo(3921447.42, 2);
    expect(anos[2]!.valor).toBeCloseTo(4057568.49, 2);
  });

  it("reproduz as variações anuais do documento", () => {
    expect(anos[0]!.variacao!).toBeCloseTo(0.057, 3);
    expect(anos[1]!.variacao!).toBeCloseTo(0.0723, 3);
    expect(anos[2]!.variacao!).toBeCloseTo(0.0347, 3);
  });

  it("vale também para quem reduz", () => {
    const reduz = transicaoDoCampus(1000, [700, 700, 700]);
    expect(reduz[0]!.valor).toBeCloseTo(901, 6);
    expect(reduz[1]!.valor).toBeCloseTo(901 - 0.66 * 201, 6);
    expect(reduz[2]!.valor).toBe(700);
  });

  it("o último ano é sempre a matriz daquele ano, mesmo que ela mude", () => {
    const t = transicaoDoCampus(1000, [1100, 1200, 1350]);
    expect(t[1]!.base).toBeCloseTo(t[0]!.valor, 9);
    expect(t[2]!.valor).toBe(1350);
  });

  it("câmpus que partia de zero não tem variação percentual", () => {
    const novo = transicaoDoCampus(0, [700000, 700000, 700000]);
    expect(novo[0]!.valor).toBeCloseTo(231000, 6);
    expect(novo[0]!.variacao).toBeNull();
    expect(novo[1]!.variacao).not.toBeNull();
  });
});

describe("proposta do Câmpus Venâncio Aires", () => {
  const etapas = PROPOSTAS_DE_TRANSICAO.find((p) => p.id === "venancio-aires")!.etapas;
  const matriz = (m: number) => etapas.map(() => m);

  // Tabelas 2 a 5 do documento: a base é o orçamento corrigido e a matriz, a que ele usa.
  it.each([
    ["Bagé", 2206485.793, 2255132.83, 2208918.14, 2213539.61, 2221858.26],
    ["Venâncio Aires", 1969798.139, 1643539.69, 1953485.22, 1922490.66, 1866700.47],
    ["Novo Hamburgo", 725310.0793, 1873045.83, 782696.87, 891731.76, 1087994.58],
  ] as const)("%s reproduz as tabelas do documento, ao centavo", (_nome, base, m, v28, v29, v30) => {
    const t = transicaoDoCampus(base, matriz(m), etapas);
    expect(t[0]!.valor).toBeCloseTo(base, 6);
    expect(t[1]!.valor).toBeCloseTo(v28, 2);
    expect(t[2]!.valor).toBeCloseTo(v29, 2);
    expect(t[3]!.valor).toBeCloseTo(v30, 2);
  });

  it("fecha 31,6% da diferença até 2030 e não chega à matriz", () => {
    const t = transicaoDoCampus(1000, matriz(2000), etapas);
    expect(t[3]!.valor).toBeCloseTo(1316, 6);
  });
});

describe("matriz futura pela projeção dos cursos", () => {
  it("segue quanto os cursos do câmpus rendem em relação ao primeiro ano", () => {
    expect(matrizesProjetadas(1000, [500, 550, 450], 3)).toEqual([1000, 1100, 900]);
  });
  it("câmpus sem curso projetável fica com a matriz do primeiro ano", () => {
    expect(matrizesProjetadas(700000, undefined, 3)).toEqual([700000, 700000, 700000]);
    expect(matrizesProjetadas(700000, [0, 0, 0], 3)).toEqual([700000, 700000, 700000]);
  });
});
