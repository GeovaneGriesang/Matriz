import { describe, expect, it } from "vitest";
import { matrizesProjetadas, transicaoDoCampus } from "@/lib/mdo/transicaoCumulativa";

describe("transição cumulativa da proposta ao CODIR", () => {
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

describe("matriz futura pela projeção dos cursos", () => {
  it("segue quanto os cursos do câmpus rendem em relação ao primeiro ano", () => {
    expect(matrizesProjetadas(1000, [500, 550, 450], 3)).toEqual([1000, 1100, 900]);
  });
  it("câmpus sem curso projetável fica com a matriz do primeiro ano", () => {
    expect(matrizesProjetadas(700000, undefined, 3)).toEqual([700000, 700000, 700000]);
    expect(matrizesProjetadas(700000, [0, 0, 0], 3)).toEqual([700000, 700000, 700000]);
  });
});
