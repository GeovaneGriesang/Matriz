import { describe, expect, it } from "vitest";
import { escaparCsv, montarCsv, nomeDeArquivo, normalizarCelula } from "@/lib/exportar/csv";

describe("normalizarCelula", () => {
  it("valores em reais viram número puro, com vírgula decimal e sinal", () => {
    expect(normalizarCelula("R$ 1.875.091")).toBe("1875091");
    expect(normalizarCelula("R$ 7.438")).toBe("7438");
    expect(normalizarCelula("+R$ 62.316")).toBe("62316");
    expect(normalizarCelula("-R$ 126.276")).toBe("-126276");
    expect(normalizarCelula("R$ 1.239,71")).toBe("1239,71");
    expect(normalizarCelula("R$ 0")).toBe("0");
  });

  it("números com ponto de milhar perdem o ponto, e decimais ficam como estão", () => {
    expect(normalizarCelula("8.841")).toBe("8841");
    expect(normalizarCelula("1.234.567,89")).toBe("1234567,89");
    expect(normalizarCelula("1,50")).toBe("1,50");
    expect(normalizarCelula("2027")).toBe("2027");
  });

  it("percentuais mantêm o sinal de porcento", () => {
    expect(normalizarCelula("64,0%")).toBe("64,0%");
    expect(normalizarCelula("64,0 %")).toBe("64,0%");
    expect(normalizarCelula("1.200%")).toBe("1200%");
  });

  it("texto fica como está, com os espaços arrumados", () => {
    expect(normalizarCelula("  TECNICO   EM INFORMATICA\n(integrado) ")).toBe("TECNICO EM INFORMATICA (integrado)");
    expect(normalizarCelula("1.200 h")).toBe("1.200 h");
    expect(normalizarCelula("-")).toBe("-");
  });
});

describe("escaparCsv e montarCsv", () => {
  it("coloca aspas quando há separador, aspas ou quebra de linha", () => {
    expect(escaparCsv("a;b")).toBe('"a;b"');
    expect(escaparCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(escaparCsv("simples")).toBe("simples");
  });

  it("protege contra fórmula no Excel, sem estragar números negativos", () => {
    expect(escaparCsv("=SOMA(A1)")).toBe("'=SOMA(A1)");
    expect(escaparCsv("@fulano")).toBe("'@fulano");
    expect(escaparCsv("-texto")).toBe("'-texto");
    expect(escaparCsv("-126276")).toBe("-126276");
    expect(escaparCsv("-")).toBe("-");
    expect(escaparCsv("-1,5")).toBe("-1,5");
  });

  it("monta com BOM, ponto e vírgula e CRLF", () => {
    const csv = montarCsv([["Ano", "Valor"], ["2027", "1875091"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe("﻿Ano;Valor\r\n2027;1875091\r\n");
  });
});

describe("nomeDeArquivo", () => {
  it("tira acento, hifeniza e limita o tamanho", () => {
    expect(nomeDeArquivo("2. Cenário ano a ano, CAMPUS VENÂNCIO AIRES")).toBe("2-cenario-ano-a-ano-campus-venancio-aires.csv");
    expect(nomeDeArquivo("")).toBe("tabela.csv");
    expect(nomeDeArquivo("x".repeat(100)).length).toBeLessThanOrEqual(64);
    expect(nomeDeArquivo("Relatório", "pdf")).toBe("relatorio.pdf");
  });
});
