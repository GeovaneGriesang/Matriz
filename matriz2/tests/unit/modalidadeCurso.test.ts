import { describe, expect, it } from "vitest";
import { MODALIDADES, ehChaveDeModalidade, formaDeEnsinoDoCurso, modalidadeDoCurso, tipoDeCursoLegivel } from "@/lib/modalidadeCurso";

describe("modalidade do curso", () => {
  it("técnico se divide pela oferta: integrado, subsequente e concomitante", () => {
    expect(modalidadeDoCurso("TECNICO", "INTEGRADO")).toBe("tecnico-integrado");
    expect(modalidadeDoCurso("TECNICO", "SUBSEQUENTE")).toBe("tecnico-subsequente");
    expect(modalidadeDoCurso("TECNICO", "CONCOMITANTE")).toBe("tecnico-concomitante");
    expect(modalidadeDoCurso("TECNICO", "NÃO SE APLICA")).toBe("outras");
  });

  it("Proeja vem antes de qualquer outra regra, mesmo num técnico ou num FIC", () => {
    expect(modalidadeDoCurso("TECNICO", "PROEJA - INTEGRADO")).toBe("proeja");
    expect(modalidadeDoCurso("TECNICO", "PROEJA - CONCOMITANTE")).toBe("proeja");
    expect(modalidadeDoCurso("QUALIFICACAO PROFISSIONAL (FIC)", "PROEJA - INTEGRADO")).toBe("proeja");
  });

  it("FIC, superior, pós e educação básica", () => {
    expect(modalidadeDoCurso("QUALIFICACAO PROFISSIONAL (FIC)", "NÃO SE APLICA")).toBe("fic");
    expect(modalidadeDoCurso("QUALIFICACAO PROFISSIONAL (FIC)", "CONCOMITANTE")).toBe("fic");
    for (const t of ["BACHARELADO", "LICENCIATURA", "TECNOLOGIA", "ABI"]) expect(modalidadeDoCurso(t, "NÃO SE APLICA")).toBe("superior");
    for (const t of ["ESPECIALIZACAO (LATO SENSU)", "ESPECIALIZACAO TECNICA", "MESTRADO", "MESTRADO PROFISSIONAL", "DOUTORADO"]) expect(modalidadeDoCurso(t, "NÃO SE APLICA")).toBe("pos");
    for (const t of ["ENSINO FUNDAMENTAL I", "ENSINO MEDIO", "EDUCACAO INFANTIL"]) expect(modalidadeDoCurso(t, "NÃO SE APLICA")).toBe("basico");
  });

  it("ignora acento e caixa", () => {
    expect(modalidadeDoCurso("Técnico", "Integrado")).toBe("tecnico-integrado");
    expect(modalidadeDoCurso(null, null)).toBe("outras");
  });

  it("dentro de superior, o tipo do curso por extenso distingue bacharelado de licenciatura", () => {
    expect(tipoDeCursoLegivel("BACHARELADO")).toBe("bacharelado");
    expect(tipoDeCursoLegivel("LICENCIATURA")).toBe("licenciatura");
    expect(tipoDeCursoLegivel("QUALIFICACAO PROFISSIONAL (FIC)")).toBe("FIC");
  });

  it("a forma de ensino vem do texto da MDO", () => {
    expect(formaDeEnsinoDoCurso("ENSINO PRESENCIAL")).toBe("presencial");
    expect(formaDeEnsinoDoCurso("ENSINO A DISTANCIA")).toBe("ead");
    expect(formaDeEnsinoDoCurso("Ensino a Distância")).toBe("ead");
  });

  it("as chaves da URL são só as da lista", () => {
    expect(MODALIDADES.every((m) => ehChaveDeModalidade(m.chave))).toBe(true);
    expect(ehChaveDeModalidade("qualquer")).toBe(false);
    expect(ehChaveDeModalidade(undefined)).toBe(false);
  });
});
