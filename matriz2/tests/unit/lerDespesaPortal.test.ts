import { describe, expect, it } from "vitest";
import { lerExecucaoMensal, lerOrcamentoPorAcao, nomeDaUg, numeroDoPortal } from "@/lib/orcamento/lerDespesaPortal";

const q = (v: string[]) => v.map((x) => `"${x}"`).join(";");
const CAB_DESPESA = q(["Ano e mês do lançamento", "Código Órgão Subordinado", "Código Unidade Gestora", "Nome Unidade Gestora", "Código Ação", "Valor Empenhado (R$)", "Valor Liquidado (R$)", "Valor Pago (R$)"]);

describe("lerExecucaoMensal", () => {
  const csv = [
    CAB_DESPESA,
    q(["2026/01", "26436", "151964", "INST.FED.SUL-RIO-GRANDENSE/VENANCIO AIRES", "20RL", "100,50", "40,00", "30,00"]),
    q(["2026/01", "26436", "151964", "INST.FED.SUL-RIO-GRANDENSE/VENANCIO AIRES", "20RL", "-10,25", "0,00", "0,00"]),
    q(["2026/01", "26436", "151964", "INST.FED.SUL-RIO-GRANDENSE/VENANCIO AIRES", "20TP", "999,00", "999,00", "999,00"]),
    q(["2026/01", "26402", "158147", "INST.FED.DE ALAGOAS", "20RL", "5,00", "5,00", "5,00"]),
  ].join("\n");

  it("soma planos e naturezas da mesma UG e ação, aceitando valor negativo", () => {
    const r = lerExecucaoMensal(csv, "26436");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ano: 2026, mes: 1, ugCodigo: "151964", acao: "20RL", empenhado: 90.25, liquidado: 40, pago: 30 });
  });
  it("ignora outras ações e outros órgãos", () => {
    expect(lerExecucaoMensal(csv, "26436").some((e) => e.acao === "20TP")).toBe(false);
    expect(lerExecucaoMensal(csv, "26436").some((e) => e.ugCodigo === "158147")).toBe(false);
    expect(lerExecucaoMensal(csv, "26402").map((e) => e.ugCodigo)).toEqual(["158147"]);
  });
  it("recusa um arquivo sem as colunas esperadas", () => {
    expect(() => lerExecucaoMensal("a;b\n1;2", "26436")).toThrow(/não encontrada/);
  });
});

describe("lerOrcamentoPorAcao", () => {
  const cab = q(["EXERCÍCIO", "CÓDIGO ÓRGÃO SUBORDINADO", "CÓDIGO AÇÃO", "NOME AÇÃO", "ORÇAMENTO INICIAL (R$)", "ORÇAMENTO ATUALIZADO (R$)", "ORÇAMENTO EMPENHADO (R$)", "ORÇAMENTO REALIZADO (R$)"]);
  it("soma os elementos de despesa de cada ação", () => {
    const csv = [cab, q(["2026", "26436", "2994", "ASSISTENCIA", "10,00", "12,00", "5,00", "4,00"]), q(["2026", "26436", "2994", "ASSISTENCIA", "1,00", "1,50", "0,50", "0,25"])].join("\n");
    expect(lerOrcamentoPorAcao(csv, "26436")[0]).toMatchObject({ exercicio: 2026, acao: "2994", inicial: 11, atualizado: 13.5, empenhado: 5.5, realizado: 4.25 });
  });
});

describe("auxiliares", () => {
  it("converte número brasileiro", () => {
    expect(numeroDoPortal("1.234,56")).toBe(1234.56);
    expect(numeroDoPortal("")).toBe(0);
  });
  it("tira o prefixo do órgão do nome da UG", () => {
    expect(nomeDaUg("INST.FED.SUL-RIO-GRANDENSE/C NOVO HAMBURGO")).toBe("C NOVO HAMBURGO");
    expect(nomeDaUg("INST.FED.DE EDUC.,CIE.E TEC.SUL-RIO-GRANDENSE")).toBe("INST.FED.DE EDUC.,CIE.E TEC.SUL-RIO-GRANDENSE");
  });
});
