import { describe, it, expect } from "vitest";
import { mapRows } from "@/ingestion/parsing/mapRows";
import type { ColumnMapping } from "@/ingestion/config/mappingTypes";
import { identity, parseInteiro } from "@/ingestion/parsing/transforms";

interface TestRow {
  nome: string;
  idade: number;
  apelido: string;
}

const mapping: ColumnMapping<TestRow> = {
  fileType: "DADOS_GERAIS",
  columns: {
    nome: { sourceHeaderCandidates: ["Nome", "NO_NOME"], required: true, transform: identity },
    idade: { sourceHeaderCandidates: ["Idade", "NU_IDADE"], required: true, transform: parseInteiro },
    apelido: { sourceHeaderCandidates: ["Apelido"], required: false, transform: identity },
  },
};

describe("mapRows", () => {
  it("resolve um header candidato fora de ordem (segunda posição da lista)", () => {
    // "NU_IDADE" está na 2a posição dos candidatos de "idade", mas é o header real usado
    const csvRows = [
      ["Nome", "NU_IDADE"],
      ["João", "30"],
    ];
    const resultado = mapRows(csvRows, mapping);
    expect(resultado.issues.filter((i) => i.severity === "ERROR")).toHaveLength(0);
    expect(resultado.rows).toEqual([{ nome: "João", idade: 30, apelido: "" }]);
  });

  it("gera ERROR e não mapeia nenhuma linha quando falta uma coluna obrigatória", () => {
    const csvRows = [["Nome"], ["João"]];
    const resultado = mapRows(csvRows, mapping);
    expect(resultado.rows).toEqual([]);
    expect(
      resultado.issues.some((i) => i.severity === "ERROR" && i.code === "MISSING_REQUIRED_COLUMN"),
    ).toBe(true);
  });

  it("gera WARNING (não bloqueia) quando falta uma coluna opcional", () => {
    const csvRows = [
      ["Nome", "Idade"],
      ["João", "30"],
    ];
    const resultado = mapRows(csvRows, mapping);
    expect(resultado.rows).toEqual([{ nome: "João", idade: 30, apelido: "" }]);
    expect(
      resultado.issues.some((i) => i.severity === "WARNING" && i.code === "MISSING_OPTIONAL_COLUMN"),
    ).toBe(true);
  });

  it("exclui a linha e reporta ERROR quando a transformação de tipo falha", () => {
    const csvRows = [
      ["Nome", "Idade"],
      ["João", "não-é-um-número"],
      ["Maria", "25"],
    ];
    const resultado = mapRows(csvRows, mapping);
    expect(resultado.rows).toEqual([{ nome: "Maria", idade: 25, apelido: "" }]);
    expect(
      resultado.issues.some((i) => i.severity === "ERROR" && i.code === "TYPE_COERCION_FAILED"),
    ).toBe(true);
  });

  it("gera ERROR para arquivo vazio (sem header)", () => {
    const resultado = mapRows([], mapping);
    expect(resultado.rows).toEqual([]);
    expect(resultado.issues.some((i) => i.code === "EMPTY_FILE")).toBe(true);
  });
});
