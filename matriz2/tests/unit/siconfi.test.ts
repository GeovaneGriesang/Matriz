import { describe, expect, it } from "vitest";
import { doProprioEnte, ehFuncao, linhasDoRreo, normalizarColuna, type ItemSiconfi } from "@/lib/orcamento/siconfi";

const item = (anexo: string, coluna: string, conta: string, valor: number, extra: Partial<ItemSiconfi> = {}): ItemSiconfi => ({
  anexo,
  rotulo: anexo.endsWith("02") ? "Total das Despesas Exceto Intra-Orçamentárias" : "Padrão",
  coluna,
  cod_conta: anexo.endsWith("02") ? "RREO2TotalDespesas" : conta,
  conta,
  valor,
  instituicao: "Prefeitura Municipal de Venâncio Aires - RS",
  ...extra,
});

describe("normalizarColuna", () => {
  it("dá nome curto às colunas acumuladas e descarta as do bimestre, de saldo e de percentual", () => {
    expect(normalizarColuna("DOTAÇÃO INICIAL")).toBe("dotacaoInicial");
    expect(normalizarColuna("DOTAÇÃO INICIAL (d)")).toBe("dotacaoInicial");
    expect(normalizarColuna("DOTAÇÃO ATUALIZADA (a)")).toBe("dotacaoAtualizada");
    expect(normalizarColuna("DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)")).toBe("empenhado");
    expect(normalizarColuna("DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)")).toBe("liquidado");
    expect(normalizarColuna("DESPESAS PAGAS ATÉ O BIMESTRE (j)")).toBe("pago");
    expect(normalizarColuna("PREVISÃO ATUALIZADA (a)")).toBe("previsaoAtualizada");
    expect(normalizarColuna("Até o Bimestre (c)")).toBe("realizado");
    expect(normalizarColuna("DESPESAS EMPENHADAS NO BIMESTRE")).toBeNull();
    expect(normalizarColuna("SALDO (c) = (a-b)")).toBeNull();
    expect(normalizarColuna("% (b/total b)")).toBeNull();
    expect(normalizarColuna("INSCRITAS EM RESTOS A PAGAR NÃO PROCESSADOS (f)")).toBeNull();
  });
});

describe("ehFuncao", () => {
  it("reconhece as funções de governo, com ou sem acento, e a reserva", () => {
    expect(ehFuncao("Educação")).toBe(true);
    expect(ehFuncao("EDUCACAO")).toBe(true);
    expect(ehFuncao("Reserva de Contingência")).toBe(true);
    expect(ehFuncao("Ensino Fundamental")).toBe(false);
    expect(ehFuncao("FU12 - Administração Geral")).toBe(false);
  });
});

describe("linhasDoRreo", () => {
  it("põe cada subfunção sob a função de cima, coluna a coluna, mesmo com nomes repetidos entre funções", () => {
    const A2 = "RREO-Anexo 02";
    const itens: ItemSiconfi[] = [];
    for (const [coluna, f] of [
      ["DOTAÇÃO INICIAL", 1],
      ["DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)", 0.5],
    ] as const) {
      itens.push(item(A2, coluna, "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)", 300 * f));
      itens.push(item(A2, coluna, "Saúde", 100 * f), item(A2, coluna, "Administração Geral", 10 * f));
      itens.push(item(A2, coluna, "Educação", 200 * f), item(A2, coluna, "Administração Geral", 20 * f), item(A2, coluna, "Ensino Fundamental", 180 * f));
      // O quadro intraorçamentário fica de fora.
      itens.push(item(A2, coluna, "Educação", 999, { rotulo: "Total das Despesas Intra-Orçamentárias" }));
    }
    const linhas = linhasDoRreo(itens);
    const adm = linhas.filter((l) => l.conta === "Administração Geral" && l.coluna === "dotacaoInicial");
    expect(adm.map((l) => [l.funcao, l.valor])).toEqual([
      ["Saúde", 10],
      ["Educação", 20],
    ]);
    expect(new Set(adm.map((l) => l.ordem)).size).toBe(2);
    const educacao = linhas.filter((l) => l.conta === "Educação" && l.nivel === "funcao");
    expect(educacao.map((l) => [l.coluna, l.valor])).toEqual([
      ["dotacaoInicial", 200],
      ["empenhado", 100],
    ]);
    expect(linhas.find((l) => l.nivel === "total")?.funcao).toBeNull();
  });

  it("marca no Anexo 01 a receita e a despesa pela coluna", () => {
    const A1 = "RREO-Anexo 01";
    const linhas = linhasDoRreo([
      item(A1, "PREVISÃO INICIAL", "ReceitasExcetoIntraOrcamentarias", 500),
      item(A1, "Até o Bimestre (c)", "ReceitasExcetoIntraOrcamentarias", 250),
      item(A1, "DOTAÇÃO INICIAL (d)", "DespesasExcetoIntraOrcamentarias", 480),
      item(A1, "DESPESAS PAGAS ATÉ O BIMESTRE (j)", "DespesasExcetoIntraOrcamentarias", 200),
    ]);
    expect(linhas.map((l) => [l.codConta, l.nivel, l.coluna])).toEqual([
      ["ReceitasExcetoIntraOrcamentarias", "receita", "previsaoInicial"],
      ["ReceitasExcetoIntraOrcamentarias", "receita", "realizado"],
      ["DespesasExcetoIntraOrcamentarias", "despesa", "dotacaoInicial"],
      ["DespesasExcetoIntraOrcamentarias", "despesa", "pago"],
    ]);
  });
});

describe("doProprioEnte", () => {
  it("descarta o consórcio que entrega o relatório com o código do município", () => {
    const itens = [
      item("RREO-Anexo 02", "DOTAÇÃO INICIAL", "Saúde", 1, { instituicao: "CONSÓRCIO INTERMUNICIPAL DE SERVIÇOS DO VALE DO RIO PARDO-CISVALE" }),
      item("RREO-Anexo 02", "DOTAÇÃO INICIAL", "Saúde", 2),
    ];
    expect(doProprioEnte(itens).map((i) => i.valor)).toEqual([2]);
  });
});
