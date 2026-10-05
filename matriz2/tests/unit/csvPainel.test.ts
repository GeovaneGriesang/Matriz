import { describe, expect, it } from "vitest";
import {
  classificarArquivo,
  classificarArquivoOrcamento,
  converterCelula,
  deveIgnorar,
  dividirLinha,
  nivelDoTexto,
  normalizarNome,
  rotulosUnicos,
} from "@/lib/pnp/csvPainel";

describe("leitura dos CSVs do painel da PNP", () => {
  it("divide por ponto e vírgula e tira o BOM", () => {
    expect(dividirLinha("﻿Nível;Ano Base;Instituição")).toEqual(["Nível", "Ano Base", "Instituição"]);
  });

  it("respeita aspas e ponto e vírgula dentro do texto", () => {
    expect(dividirLinha('Campus;"Curso; de teste";"diz ""oi"""')).toEqual(["Campus", "Curso; de teste", 'diz "oi"']);
  });

  it("converte decimal com vírgula, milhar e inteiros", () => {
    expect(converterCelula("898407,025")).toBe(898407.025);
    expect(converterCelula("1031798")).toBe(1031798);
    expect(converterCelula("1.031.798")).toBe(1031798);
    expect(converterCelula("0,7258")).toBe(0.7258);
    expect(converterCelula("-3,5")).toBe(-3.5);
  });

  it("deixa legenda como texto e vazio como ausente", () => {
    expect(converterCelula("(+3,66)")).toBe("(+3,66)");
    expect(converterCelula("0<RFP<=0,5")).toBe("0<RFP<=0,5");
    expect(converterCelula("")).toBeUndefined();
    expect(converterCelula("   ")).toBeUndefined();
  });

  it("dá rótulos únicos quando o painel repete o título do cartão", () => {
    expect(rotulosUnicos(["Matrículas", "Vagas", "Matrículas", "Matrículas"])).toEqual([
      "Matrículas",
      "Vagas",
      "Matrículas (2)",
      "Matrículas (3)",
    ]);
  });

  it("classifica o arquivo principal e o detalhamento pelo caminho", () => {
    expect(classificarArquivo("Dados Gerais/Situação de Matrícula.csv")).toEqual({
      aba: "Dados Gerais",
      subaba: "Situação de Matrícula",
      dimensao: "",
    });
    expect(
      classificarArquivo("Perfis de Matrículas\\Raça e Renda - detalhamentos\\Raça e Renda - por Renda Familiar.csv"),
    ).toEqual({ aba: "Perfis de Matrículas", subaba: "Raça e Renda", dimensao: "Renda Familiar" });
    expect(
      classificarArquivo(
        "Perfis de Matrículas/Formas de Ingresso - detalhamentos/Formas de Ingresso - por Forma de Ingresso (Sigla).csv",
      )?.dimensao,
    ).toBe("Forma de Ingresso (Sigla)");
    expect(classificarArquivo("Dados Gerais/PNP_2027_LEIA-ME.txt")).toBeNull();
  });

  it("ignora só o que a Série Histórica repete", () => {
    const serie = (dimensao: string) => ({ aba: "Dados Gerais", subaba: "Série Histórica", dimensao });
    expect(deveIgnorar(serie(""))).toBe(true);
    expect(deveIgnorar(serie("Eixo Tecnológico"))).toBe(true);
    expect(deveIgnorar(serie("Renda Familiar"))).toBe(false);
    expect(deveIgnorar({ aba: "Dados Gerais", subaba: "Curso, Matrícula e Oferta", dimensao: "" })).toBe(false);
  });

  it("normaliza nomes para casar estruturas", () => {
    expect(normalizarNome("Campus Venâncio Aires")).toBe(normalizarNome("CAMPUS VENÂNCIO AIRES"));
    expect(normalizarNome("IF FARROUPILHA")).toBe(normalizarNome("IFFARROUPILHA"));
    // o Câmpus Avançado Novo Hamburgo deixou de ser avançado: a MDO ainda usa o nome antigo e a PNP o novo
    expect(normalizarNome("CAMPUS AVANÇADO NOVO HAMBURGO")).toBe(normalizarNome("Campus Novo Hamburgo"));
    expect(nivelDoTexto("Instituição")).toBe("INSTITUICAO");
    expect(nivelDoTexto("Campus")).toBe("CAMPUS");
    expect(nivelDoTexto("Outro")).toBeNull();
  });

  it("classifica os arquivos do painel orçamentário", () => {
    expect(classificarArquivoOrcamento("Explorar Dados/Execução do Exercício/Explorar Dados - Execução do Exercício.csv")).toEqual({
      aba: "Explorar Dados",
      subaba: "Execução do Exercício",
      dimensao: "",
    });
    expect(
      classificarArquivoOrcamento(
        ["Explorar Dados", "Descentralizações", "Explorar Dados - Descentralizações - por Ação Orçamentária.csv"].join("\\"),
      ),
    ).toEqual({ aba: "Explorar Dados", subaba: "Descentralizações", dimensao: "Ação Orçamentária" });
    expect(classificarArquivoOrcamento("Gastos Totais da Rede/Gastos Totais da Rede.csv")).toEqual({
      aba: "Gastos Totais da Rede",
      subaba: "Gastos Totais da Rede",
      dimensao: "",
    });
    expect(classificarArquivoOrcamento("Indicadores Orçamentários/Indicadores Orçamentários - por RP e GND.csv")?.dimensao).toBe("RP e GND");
    expect(classificarArquivoOrcamento("LEIA-ME.txt")).toBeNull();
  });
});
