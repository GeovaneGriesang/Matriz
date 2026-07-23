import { describe, it, expect } from "vitest";
import { parseCsv } from "@/ingestion/parsing/csvParser";

describe("parseCsv", () => {
  it("faz o parsing de campos delimitados por ponto-e-vírgula (padrão PNP)", () => {
    const texto = 'Nome;Curso\n"Silva; João";"Técnico em Informática"\n';
    const linhas = parseCsv(texto);
    expect(linhas).toEqual([
      ["Nome", "Curso"],
      ["Silva; João", "Técnico em Informática"],
    ]);
  });

  it("faz o parsing de campos entre aspas contendo quebras de linha", () => {
    const texto = 'Nome;Observacao\nJoão;"linha 1\nlinha 2"\n';
    const linhas = parseCsv(texto);
    expect(linhas).toEqual([
      ["Nome", "Observacao"],
      ["João", "linha 1\nlinha 2"],
    ]);
  });

  it("não produz uma linha fantasma para uma linha em branco no final", () => {
    const texto = "Nome;Curso\nJoão;Informática\n\n";
    const linhas = parseCsv(texto);
    expect(linhas).toHaveLength(2);
  });

  it("remove o BOM UTF-8 do primeiro campo, se presente", () => {
    const texto = "﻿Nome;Curso\nJoão;Informática\n";
    const linhas = parseCsv(texto);
    expect(linhas[0]?.[0]).toBe("Nome");
  });
});
