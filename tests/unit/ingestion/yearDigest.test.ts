import { describe, it, expect } from "vitest";
import { agruparPorAno, calcularDigestAno } from "@/ingestion/persistence/yearDigest";
import type { ColumnMapping } from "@/ingestion/config/mappingTypes";

/**
 * Mapeamento mínimo só para os testes: o digest usa apenas os NOMES dos campos
 * (`Object.keys(mapping.columns)`), nunca os transforms, então basta a forma.
 */
const mapping = {
  fileType: "DADOS_GERAIS",
  columns: {
    ano: { sourceHeaderCandidates: ["Ano"], required: true, transform: (v: string) => v, kind: "dimension" },
    instituicaoSigla: {
      sourceHeaderCandidates: ["Instituicao"],
      required: true,
      transform: (v: string) => v,
      kind: "dimension",
    },
    numeroMatriculas: {
      sourceHeaderCandidates: ["Número de Matrículas"],
      required: true,
      transform: (v: string) => v,
      kind: "measure",
      measureLabel: "Número de Matrículas",
    },
  },
} as unknown as ColumnMapping<Record<string, unknown>>;

const linha = (ano: number, sigla: string, matriculas: number | null) => ({
  ano,
  instituicaoSigla: sigla,
  numeroMatriculas: matriculas,
});

describe("agruparPorAno", () => {
  it("separa as linhas por ano-base preservando a ordem original dentro de cada ano", () => {
    const grupos = agruparPorAno([
      linha(2024, "IFSUL", 10),
      linha(2025, "IFSUL", 20),
      linha(2024, "IFRS", 30),
    ]);

    expect([...grupos.keys()].sort()).toEqual([2024, 2025]);
    expect(grupos.get(2024)).toEqual([linha(2024, "IFSUL", 10), linha(2024, "IFRS", 30)]);
    expect(grupos.get(2025)).toEqual([linha(2025, "IFSUL", 20)]);
  });

  it("devolve mapa vazio para lista vazia", () => {
    expect(agruparPorAno([]).size).toBe(0);
  });
});

describe("calcularDigestAno", () => {
  it("dá o mesmo digest para o mesmo conteúdo (é o que faz um ano ser pulado na reimportação)", () => {
    const linhas = [linha(2025, "IFSUL", 10), linha(2025, "IFRS", 20)];
    expect(calcularDigestAno(linhas, mapping)).toBe(calcularDigestAno([...linhas], mapping));
  });

  it("muda quando um valor de medida muda — é isso que detecta reprocessamento da PNP", () => {
    const antes = calcularDigestAno([linha(2025, "IFSUL", 10)], mapping);
    const depois = calcularDigestAno([linha(2025, "IFSUL", 11)], mapping);
    expect(depois).not.toBe(antes);
  });

  it("muda quando uma linha é acrescentada", () => {
    const antes = calcularDigestAno([linha(2025, "IFSUL", 10)], mapping);
    const depois = calcularDigestAno([linha(2025, "IFSUL", 10), linha(2025, "IFRS", 20)], mapping);
    expect(depois).not.toBe(antes);
  });

  it("distingue null de zero (medida ausente não é medida igual a zero)", () => {
    const comNulo = calcularDigestAno([linha(2025, "IFSUL", null)], mapping);
    const comZero = calcularDigestAno([linha(2025, "IFSUL", 0)], mapping);
    expect(comNulo).not.toBe(comZero);
  });

  it("não confunde linhas cujos campos concatenados dariam o mesmo texto sem separador", () => {
    // Sem um separador entre campos, "AB"+"C" e "A"+"BC" colidiriam.
    const a = calcularDigestAno([{ ano: 2025, instituicaoSigla: "AB", numeroMatriculas: "C" }], mapping);
    const b = calcularDigestAno([{ ano: 2025, instituicaoSigla: "A", numeroMatriculas: "BC" }], mapping);
    expect(a).not.toBe(b);
  });

  it("não confunde duas linhas com uma linha só que concatene as duas", () => {
    const duasLinhas = calcularDigestAno(
      [
        { ano: 2025, instituicaoSigla: "IFSUL", numeroMatriculas: "1" },
        { ano: 2025, instituicaoSigla: "IFRS", numeroMatriculas: "2" },
      ],
      mapping,
    );
    const umaLinha = calcularDigestAno(
      [{ ano: 2025, instituicaoSigla: "IFSUL", numeroMatriculas: "1IFRS2" }],
      mapping,
    );
    expect(duasLinhas).not.toBe(umaLinha);
  });

  it("independe da ordem das chaves no objeto da linha (campos entram em ordem alfabética fixa)", () => {
    const ordemA = calcularDigestAno([{ ano: 2025, instituicaoSigla: "IFSUL", numeroMatriculas: 10 }], mapping);
    const ordemB = calcularDigestAno([{ numeroMatriculas: 10, instituicaoSigla: "IFSUL", ano: 2025 }], mapping);
    expect(ordemB).toBe(ordemA);
  });

  it("é um sha-256 (64 caracteres hexadecimais)", () => {
    expect(calcularDigestAno([linha(2025, "IFSUL", 10)], mapping)).toMatch(/^[0-9a-f]{64}$/);
  });
});
