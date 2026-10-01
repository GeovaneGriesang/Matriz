import { describe, expect, it } from "vitest";
import { AgregadorMatriculas, dataBrParaIso } from "@/lib/pnp/microdados";

/** Monta um CSV mínimo com as colunas que o agregador lê (a ordem não importa). */
function csv(colunas: string[], linhas: Record<string, string>[]): string[] {
  return [colunas.join(";"), ...linhas.map((l) => colunas.map((c) => l[c] ?? "").join(";"))];
}

const BASE = [
  "Ano", "Carga Horaria", "Carga Horaria Mínima", "Categoria da Situação", "Co Inst", "Cod Unidade",
  "Código do Ciclo Matricula", "Data de Fim Previsto do Ciclo", "Data de Inicio do Ciclo", "Fator Esforço Curso",
  "Instituição", "Nome de Curso", "Renda Familiar", "Situação de Matrícula", "Tipo de Curso", "Tipo de Oferta",
  "Unidade de Ensino", "Matrícula Atendida", "Vagas Ofertadas",
];

const linha = (extra: Record<string, string> = {}) => ({
  Ano: "2025", "Carga Horaria": "3200", "Carga Horaria Mínima": "1200", "Categoria da Situação": "Em curso",
  "Co Inst": "26418", "Cod Unidade": "159", "Código do Ciclo Matricula": "3309097",
  "Data de Fim Previsto do Ciclo": "28/12/2027", "Data de Inicio do Ciclo": "28/07/2025", "Fator Esforço Curso": "1,1",
  Instituição: "IFPE", "Nome de Curso": "Técnico em Informática", "Renda Familiar": "0,5<RFP<=1",
  "Situação de Matrícula": "Em curso", "Tipo de Curso": "Técnico", "Tipo de Oferta": "Integrado",
  "Unidade de Ensino": "Campus Caruaru", "Matrícula Atendida": "Sim", "Vagas Ofertadas": "40", ...extra,
});

describe("agregação dos microdados de matrículas por ciclo", () => {
  it("converte datas dd/mm/aaaa", () => {
    expect(dataBrParaIso("28/12/2025")).toBe("2025-12-28");
    expect(dataBrParaIso("")).toBeNull();
    expect(dataBrParaIso("2025-12-28")).toBeNull();
  });

  it("junta as matrículas do mesmo ciclo e conta por situação e renda", () => {
    const ag = new AgregadorMatriculas();
    for (const l of csv(BASE, [
      linha(),
      linha({ "Categoria da Situação": "Evadidos", "Situação de Matrícula": "Abandono", "Renda Familiar": "1<RFP<=1,5" }),
      linha({ "Matrícula Atendida": "Não" }),
    ])) ag.adicionar(l);
    expect(ag.ciclos.size).toBe(1);
    const c = [...ag.ciclos.values()][0]!;
    expect(c.matriculas).toBe(3);
    expect(c.atendidas).toBe(2);
    expect(c.porSituacao).toEqual({ "Em curso | Em curso": 2, "Evadidos | Abandono": 1 });
    expect(c.porRenda["0,5<RFP<=1"]).toBe(2);
    expect(c.cargaHoraria).toBe(3200);
    expect(c.cargaHorariaMinima).toBe(1200);
    expect(c.fatorEsforco).toBeCloseTo(1.1, 6);
    expect(c.inicio).toBe("2025-07-28");
    expect(c.fimPrevisto).toBe("2027-12-28");
    expect(c.vagas).toBe(40);
  });

  it("separa ciclos diferentes", () => {
    const ag = new AgregadorMatriculas();
    for (const l of csv(BASE, [linha(), linha({ "Código do Ciclo Matricula": "9999" })])) ag.adicionar(l);
    expect(ag.ciclos.size).toBe(2);
  });

  it("nos layouts antigos, cada linha vale 'Número de registros' matrículas e faltam colunas", () => {
    const antigo = BASE.filter((c) => c !== "Vagas Ofertadas" && c !== "Matrícula Atendida").concat("Número de registros");
    const ag = new AgregadorMatriculas();
    for (const l of csv(antigo, [linha({ "Número de registros": "7" }), linha({ "Número de registros": "3" })])) ag.adicionar(l);
    const c = [...ag.ciclos.values()][0]!;
    expect(c.matriculas).toBe(10);
    expect(c.atendidas).toBe(10);
    expect(c.vagas).toBeNull();
    expect(ag.linhas).toBe(10);
  });

  it("recusa um arquivo sem as colunas essenciais", () => {
    const ag = new AgregadorMatriculas();
    expect(() => ag.adicionar("Ano;Carga Horaria")).toThrow(/Código do Ciclo Matricula|Instituição/);
  });

  it("ignora linhas sem ciclo", () => {
    const ag = new AgregadorMatriculas();
    for (const l of csv(BASE, [linha({ "Código do Ciclo Matricula": "" })])) ag.adicionar(l);
    expect(ag.ciclos.size).toBe(0);
    expect(ag.linhasSemCiclo).toBe(1);
  });
});
