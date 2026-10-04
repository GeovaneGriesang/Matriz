import { describe, expect, it } from "vitest";
import { lerCreditos, lerTotaisDoQuadroSintese } from "@/lib/orcamento/lerQuadroLoa";

// Trechos reais do texto (pdftotext -raw) da LOA 2026 e do PLOA 2027 do IFSul.
const LOA = `Total 594.635.124 593.465.134 713.662.876 710.466.853
603.788.735
Código/Especificação PLO 2025 LOA 2025 PLO 2026 LOA 2026
5112 20RL 0043
F 3-ODC 2 90 8 1000 44.027.867
Estudante matriculado (unidade): 22.429
F 3-ODC 6 90 8 1000 1.000.000
5112 2994 0043
F 3-ODC 2 90 0 1000 6.532.860
Estudante assistido (unidade): 2.600`;

const PLOA = `Total 682.798.472 682.006.134 713.662.876 762.725.529
LOA
2026
710.466.853
PLO
2027
5112 20RL 0043 Funcionamento das Instituições (Seq: 5537)
F 3 - ODC 2 90 8 1000 48.207.046
Produto: Estudante matriculado (unidade): 22.000
F 4 - INV 2 90 8 1050 30.000`;

describe("lerCreditos", () => {
  it("lê os dois formatos de linha de crédito e liga cada um à sua ação", () => {
    const loa = lerCreditos(LOA);
    expect(loa.map((c) => [c.acao, c.resultadoPrimario, c.valor])).toEqual([
      ["20RL", 2, 44027867],
      ["20RL", 6, 1000000],
      ["2994", 2, 6532860],
    ]);
    const ploa = lerCreditos(PLOA);
    expect(ploa.map((c) => [c.acao, c.gnd, c.fonteRecurso, c.valor])).toEqual([
      ["20RL", 3, 1000, 48207046],
      ["20RL", 4, 1050, 30000],
    ]);
  });

  it("aplica o produto e a meta a todos os créditos da ação", () => {
    const loa = lerCreditos(LOA);
    expect(loa[0]).toMatchObject({ produto: "Estudante matriculado (unidade)", meta: 22429 });
    expect(loa[1]).toMatchObject({ meta: 22429 });
    expect(loa[2]).toMatchObject({ produto: "Estudante assistido (unidade)", meta: 2600 });
    expect(lerCreditos(PLOA)[1]).toMatchObject({ meta: 22000 });
  });
});

describe("lerTotaisDoQuadroSintese", () => {
  it("separa os quatro totais da linha Total do quinto, que vem solto", () => {
    const t = lerTotaisDoQuadroSintese(LOA, {
      colunas: [["PLOA", 2025], ["LOA", 2025], ["PLOA", 2026], ["LOA", 2026]],
      solto: ["EMPENHADO", 2024],
    });
    expect(t.find((x) => x.documento === "LOA" && x.exercicio === 2026)?.valor).toBe(710466853);
    expect(t.find((x) => x.documento === "EMPENHADO" && x.exercicio === 2024)?.valor).toBe(603788735);
  });

  it("usa a ordem própria de cada documento", () => {
    const t = lerTotaisDoQuadroSintese(PLOA, {
      colunas: [["LEI_CREDITOS", 2025], ["EMPENHADO", 2025], ["PLOA", 2026], ["PLOA", 2027]],
      solto: ["LOA", 2026],
    });
    expect(t.find((x) => x.documento === "PLOA" && x.exercicio === 2027)?.valor).toBe(762725529);
    expect(t.find((x) => x.documento === "LOA" && x.exercicio === 2026)?.valor).toBe(710466853);
  });

  it("recusa um texto sem a linha Total", () => {
    expect(() => lerTotaisDoQuadroSintese("nada", { colunas: [["LOA", 2026], ["LOA", 2026], ["LOA", 2026], ["LOA", 2026]], solto: ["LOA", 2026] })).toThrow();
  });
});
