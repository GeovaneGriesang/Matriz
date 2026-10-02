import { describe, expect, it } from "vitest";
import { SEM_TETO_DE_CH, padroesDoCurso } from "@/lib/mdo/padroesCurso";

describe("padrões sugeridos para um curso novo", () => {
  it("técnico integrado: 4 anos, CH no teto da matriz (3.200 h quando a mínima do MEC é 1.200 h)", () => {
    expect(padroesDoCurso("TECNICO", "INTEGRADO", 1200)).toMatchObject({ anosDuracao: 4, chTotal: 3200, teto: 3200 });
    expect(padroesDoCurso("TECNICO", "INTEGRADO", 800)).toMatchObject({ chTotal: 3000, teto: 3000 });
  });

  it("técnico subsequente dura 2 anos e a CH sugerida é a mínima do MEC", () => {
    expect(padroesDoCurso("TECNICO", "SUBSEQUENTE", 1200)).toMatchObject({ anosDuracao: 2, chTotal: 1200, teto: 1200 });
  });

  it("bacharelado em administração: 4 anos e 3.000 h; engenharia (3.600 h ou mais) dura 5", () => {
    expect(padroesDoCurso("BACHARELADO", "NÃO SE APLICA", 3000)).toMatchObject({ anosDuracao: 4, chTotal: 3000, teto: 3000 });
    expect(padroesDoCurso("BACHARELADO", "NÃO SE APLICA", 3600).anosDuracao).toBe(5);
  });

  it("FIC dura meses, e as cargas padrão de 1.600 a 3.200 h do catálogo viram 160 h", () => {
    expect(padroesDoCurso("QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA", 160)).toMatchObject({ anosDuracao: 1, mesesDuracao: 4, chTotal: 160, teto: SEM_TETO_DE_CH });
    expect(padroesDoCurso("QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA", 3200).chTotal).toBe(160);
    expect(padroesDoCurso("QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA", 200).chTotal).toBe(200);
  });

  it("especialização dura 18 meses; tipo desconhecido cai num padrão seguro", () => {
    expect(padroesDoCurso("ESPECIALIZACAO (LATO SENSU)", "NÃO SE APLICA", 360)).toMatchObject({ mesesDuracao: 18, chTotal: 360 });
    expect(padroesDoCurso("OUTRO", "NÃO SE APLICA", 0)).toMatchObject({ anosDuracao: 2, chTotal: 800 });
  });
});
