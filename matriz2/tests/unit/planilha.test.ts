import { describe, expect, it } from "vitest";
import { data, dataDeGeracao, numero, numeroOuZero, texto, valorDaCelula } from "@/carga/planilha";

describe("valorDaCelula", () => {
  it("desembrulha o resultado de uma fórmula", () => {
    // O exceljs entrega células de fórmula como { formula, result }; quem lê a
    // planilha quer o resultado, nunca a string da fórmula.
    expect(valorDaCelula({ formula: "Q18*'DADOS BASE'!$I$29", result: 1412480.884 })).toBe(1412480.884);
  });

  it("junta os trechos de um texto formatado", () => {
    expect(valorDaCelula({ richText: [{ text: "Gerado em " }, { text: "30/08/2026" }] })).toBe("Gerado em 30/08/2026");
  });

  it("trata célula de erro como ausência", () => {
    expect(valorDaCelula({ error: "#DIV/0!" })).toBeNull();
  });

  it("deixa passar número, texto e nulo", () => {
    expect(valorDaCelula(42)).toBe(42);
    expect(valorDaCelula("IFSUL")).toBe("IFSUL");
    expect(valorDaCelula(null)).toBeNull();
    expect(valorDaCelula(undefined)).toBeNull();
  });
});

describe("texto", () => {
  it("apara espaços e trata vazio como ausência", () => {
    expect(texto("  CAMPUS PELOTAS  ")).toBe("CAMPUS PELOTAS");
    expect(texto("   ")).toBeNull();
    expect(texto(null)).toBeNull();
  });

  it("lê o texto de dentro de uma fórmula", () => {
    expect(texto({ formula: "A1", result: " S " })).toBe("S");
  });
});

describe("numero", () => {
  it("aceita número puro e o resultado de fórmula", () => {
    expect(numero(1201.4678)).toBe(1201.4678);
    expect(numero({ formula: "X", result: 700000 })).toBe(700000);
  });

  it("entende número escrito no formato brasileiro", () => {
    expect(numero("1.831.831.659,98")).toBeCloseTo(1831831659.98, 2);
    expect(numero("0,25")).toBe(0.25);
  });

  it("devolve nulo para vazio e para texto que não é número", () => {
    expect(numero("")).toBeNull();
    expect(numero("   ")).toBeNull();
    expect(numero("n/d")).toBeNull();
    expect(numero(null)).toBeNull();
  });

  it("distingue ausência de zero, e numeroOuZero achata os dois", () => {
    // A distinção importa: numa coluna de dinheiro, vazio é zero; numa de ano de
    // criação, vazio não é ano zero.
    expect(numero(null)).toBeNull();
    expect(numero(0)).toBe(0);
    expect(numeroOuZero(null)).toBe(0);
    expect(numeroOuZero(0)).toBe(0);
  });
});

describe("data", () => {
  it("converte o número de série do Excel", () => {
    // 42065 é 02/03/2015 na planilha da 6ª fase (ciclo HOTELARIA). O leitor em
    // fluxo do exceljs entrega a data assim, como número, ao contrário do comum.
    const d = data(42065);
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2015-03-02");
  });

  it("usa a época de 1899-12-30, e não 1900-01-01", () => {
    // O Excel conta 1900 como bissexto por um bug histórico que a Microsoft manteve
    // por compatibilidade; errar a época desloca todas as datas em dois dias.
    expect(data(1)!.toISOString().slice(0, 10)).toBe("1899-12-31");
    expect(data(59)!.toISOString().slice(0, 10)).toBe("1900-02-27");
  });

  it("deixa passar um Date e recusa zero", () => {
    const d = new Date(Date.UTC(2027, 0, 15));
    expect(data(d)).toBe(d);
    expect(data(0)).toBeNull();
    expect(data(null)).toBeNull();
  });
});

describe("dataDeGeracao", () => {
  it("lê a data que a planilha declara no cabeçalho", () => {
    const d = dataDeGeracao("Gerado em 30/08/2026, 12:07:47");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(7); // agosto
    expect(d!.getDate()).toBe(30);
    expect(d!.getHours()).toBe(12);
  });

  it("aceita a data sem hora", () => {
    const d = dataDeGeracao("Gerado em 27/08/2026");
    expect(d!.getDate()).toBe(27);
    expect(d!.getHours()).toBe(0);
  });

  it("devolve nulo quando não há data no texto", () => {
    expect(dataDeGeracao("Proposta Matriz Distribuição Orçamentária")).toBeNull();
    expect(dataDeGeracao(null)).toBeNull();
  });
});
