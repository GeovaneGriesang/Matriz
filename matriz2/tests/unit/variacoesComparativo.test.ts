import { describe, expect, it } from "vitest";
import { VARIACOES, totalDaVariacao, variacaoDoCampus, variacaoEntre, type ValoresDoCampus } from "@/lib/variacoesComparativo";

const campus: ValoresDoCampus = { calculadoA: 100, informadoA: 110, calculadoB: 120, informadoB: 99 };
const def = (chave: string) => VARIACOES.find((v) => v.chave === chave)!;

describe("variações do comparativo entre ciclos", () => {
  it("são as cinco pedidas, na ordem", () => {
    expect(VARIACOES.map((v) => v.chave)).toEqual(["calcA_infA", "calcA_calcB", "infA_calcB", "infA_infB", "calcB_infB"]);
  });

  it("cada uma vai do primeiro valor para o segundo", () => {
    const abs = (c: string) => variacaoDoCampus(def(c), campus)!.absoluta;
    expect(abs("calcA_infA")).toBe(10); // calculado 2026 -> informado 2026
    expect(abs("calcA_calcB")).toBe(20); // calculado 2026 -> calculado 2027
    expect(abs("infA_calcB")).toBe(10); // informado 2026 -> calculado 2027
    expect(abs("infA_infB")).toBe(-11); // informado 2026 -> informado 2027
    expect(abs("calcB_infB")).toBe(-21); // calculado 2027 -> informado 2027
  });

  it("o percentual é chegada sobre partida, e some quando a partida é zero", () => {
    expect(variacaoEntre(100, 120)!.percentual).toBeCloseTo(0.2, 9);
    expect(variacaoEntre(200, 100)!.percentual).toBeCloseTo(-0.5, 9);
    expect(variacaoEntre(0, 50)).toEqual({ absoluta: 50, percentual: null });
  });

  it("sem informado cadastrado, as variações que dependem dele ficam vazias e as outras seguem", () => {
    const sem: ValoresDoCampus = { ...campus, informadoA: null, informadoB: null };
    expect(variacaoDoCampus(def("calcA_infA"), sem)).toBeNull();
    expect(variacaoDoCampus(def("infA_infB"), sem)).toBeNull();
    expect(variacaoDoCampus(def("calcA_calcB"), sem)!.absoluta).toBe(20);
  });

  it("o total só soma os câmpus que têm os dois valores, e diz quantos entraram", () => {
    const lista: ValoresDoCampus[] = [
      campus,
      { calculadoA: 1000, informadoA: null, calculadoB: 1000, informadoB: null }, // sem informado: fora dos totais que dependem dele
    ];
    const t = totalDaVariacao(def("calcA_infA"), lista)!;
    expect(t.de).toBe(100);
    expect(t.para).toBe(110);
    expect(t.comparados).toBe(1);
    expect(t.total).toBe(2);
    // Calculado contra calculado entra com os dois câmpus.
    expect(totalDaVariacao(def("calcA_calcB"), lista)!.comparados).toBe(2);
    expect(totalDaVariacao(def("infA_infB"), [{ ...campus, informadoA: null }])).toBeNull();
  });
});
