import { describe, expect, it } from "vitest";
import { ajusteParaManterMooc, repartirMooc } from "@/lib/mdo/manterMooc";

describe("manter o MOOC num número fixo", () => {
  const hoje = { alunos: 1000, medida: 100_000, contados: 1000 };
  const anos = [
    { matric: 100_000, repos: 0, reposTudo: 0, contados: 1000 },
    { matric: 10_000, repos: 30_000, reposTudo: 50_000, contados: 400 },
  ];

  it("não mexe no ano de hoje e completa os anos seguintes até o alvo", () => {
    const a = ajusteParaManterMooc(anos, hoje, 1000);
    expect(a[0]).toEqual({ repos: 0, reposTudo: 0, contados: 0 });
    // 1.000 alunos a R$ 100 cada = R$ 100 mil; a projeção dava 10 + 30 mil no cenário e 10 + 50 mil sem mudanças.
    expect(a[1]!.repos).toBeCloseTo(60_000);
    expect(a[1]!.reposTudo).toBeCloseTo(40_000);
    expect(a[1]!.contados).toBeCloseTo(600);
  });

  it("aceita um alvo menor que a projeção (ajuste negativo)", () => {
    expect(ajusteParaManterMooc(anos, hoje, 100)[1]!.repos).toBeCloseTo(-30_000);
  });

  it("sem alunos MOOC hoje, não há o que manter", () => {
    expect(ajusteParaManterMooc(anos, { alunos: 0, medida: 0, contados: 0 }, 500)[1]).toEqual({ repos: 0, reposTudo: 0, contados: 0 });
  });

  it("reparte o número da instituição pelos alunos MOOC de hoje de cada câmpus", () => {
    expect(repartirMooc(300, new Map([[1, 100], [2, 200], [3, 0]]))).toEqual({ "1": 100, "2": 200 });
  });
});
