import { describe, it, expect } from "vitest";
import { validateRequiredFields } from "@/ingestion/validation/rules/requiredFields";
import { validateNonNegativeNumbers } from "@/ingestion/validation/rules/typeCoercion";
import { validateReferentialConsistency } from "@/ingestion/validation/rules/referentialConsistency";
import { validateCrossFileMatriculaCounts } from "@/ingestion/validation/rules/crossFileConsistency";

describe("validateRequiredFields", () => {
  it("passa sem issues quando todos os campos obrigatórios estão preenchidos", () => {
    const issues = validateRequiredFields([{ nome: "João" }, { nome: "Maria" }], ["nome"]);
    expect(issues).toEqual([]);
  });

  it("reporta ERROR para campo obrigatório vazio", () => {
    const issues = validateRequiredFields([{ nome: "João" }, { nome: "  " }], ["nome"]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "ERROR", code: "REQUIRED_FIELD_EMPTY", rowIndex: 1 });
  });
});

describe("validateNonNegativeNumbers", () => {
  it("passa sem issues quando todos os valores são não-negativos", () => {
    const issues = validateNonNegativeNumbers([{ mateq: 10 }, { mateq: 0 }], ["mateq"]);
    expect(issues).toEqual([]);
  });

  it("reporta ERROR para valor negativo", () => {
    const issues = validateNonNegativeNumbers([{ mateq: -5 }], ["mateq"]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "ERROR", code: "INVALID_NUMERIC_VALUE" });
  });
});

describe("validateReferentialConsistency", () => {
  it("passa sem issues quando o código de câmpus é conhecido", () => {
    const issues = validateReferentialConsistency(
      [{ codigoCampus: "VA" }],
      new Set(["VA", "PF"]),
    );
    expect(issues).toEqual([]);
  });

  it("reporta WARNING para código de câmpus desconhecido", () => {
    const issues = validateReferentialConsistency(
      [{ codigoCampus: "XX" }],
      new Set(["VA", "PF"]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "WARNING", code: "UNKNOWN_CAMPUS_REFERENCE" });
  });
});

describe("validateCrossFileMatriculaCounts", () => {
  it("passa sem issues quando as contagens estão dentro da tolerância", () => {
    const issues = validateCrossFileMatriculaCounts(
      new Map([["VA", 100]]),
      new Map([["VA", 105]]),
      "SituacaoMatricula",
      "EficienciaAcademica",
      0.1,
    );
    expect(issues).toEqual([]);
  });

  it("reporta WARNING quando a divergência excede a tolerância", () => {
    const issues = validateCrossFileMatriculaCounts(
      new Map([["VA", 100]]),
      new Map([["VA", 50]]),
      "SituacaoMatricula",
      "EficienciaAcademica",
      0.1,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "WARNING", code: "CROSS_FILE_COUNT_MISMATCH" });
  });
});
