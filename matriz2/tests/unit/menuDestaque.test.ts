import { describe, expect, it } from "vitest";
import { destaqueNaFrente, ehInstituicaoDestaque } from "@/lib/destaque";
import { GRUPOS_MENU, TODOS_OS_ITENS, itemAtivo } from "@/lib/menu";

describe("destaque do IFSul", () => {
  it("reconhece o IFSul em qualquer grafia", () => {
    expect(ehInstituicaoDestaque("IFSUL")).toBe(true);
    expect(ehInstituicaoDestaque("IFSul")).toBe(true);
    expect(ehInstituicaoDestaque("IF-SUL")).toBe(true);
    expect(ehInstituicaoDestaque("IFRS")).toBe(false);
    expect(ehInstituicaoDestaque("IFSULDEMINAS")).toBe(false);
  });

  it("põe o IFSul na frente e mantém a ordem das demais", () => {
    const lista = [{ s: "CEFET-MG" }, { s: "IFAL" }, { s: "IFSUL" }, { s: "IFRS" }];
    expect(destaqueNaFrente(lista, (i) => i.s).map((i) => i.s)).toEqual(["IFSUL", "CEFET-MG", "IFAL", "IFRS"]);
  });
});

describe("menu", () => {
  it("não repete endereço entre os itens", () => {
    const enderecos = TODOS_OS_ITENS.map((i) => i.href);
    expect(new Set(enderecos).size).toBe(enderecos.length);
  });

  it("todo item tem uma frase dizendo o que se faz na tela", () => {
    for (const g of GRUPOS_MENU) for (const i of g.itens) expect(i.descricao.length).toBeGreaterThan(20);
  });

  it("o simulador de curso de 3 ou 4 anos está no grupo Simular", () => {
    const simular = GRUPOS_MENU.find((g) => g.id === "simular")!;
    expect(simular.itens.some((i) => i.href === "/simulador/curso")).toBe(true);
  });

  it("marca o item de endereço mais longo, não o prefixo", () => {
    expect(itemAtivo("/simulador/curso")?.href).toBe("/simulador/curso");
    expect(itemAtivo("/simulador")?.href).toBe("/simulador");
    expect(itemAtivo("/consulta/valor-do-aluno")?.href).toBe("/consulta/valor-do-aluno");
    expect(itemAtivo("/consulta")?.href).toBe("/consulta");
    expect(itemAtivo("/")?.href).toBe("/");
    expect(itemAtivo("/admin/inicio")).toBeNull();
  });
});

describe("câmpus em destaque (Venâncio Aires)", () => {
  it("reconhece o Venâncio Aires com ou sem acento e em qualquer caixa", async () => {
    const { ehCampusDestaque } = await import("@/lib/destaque");
    expect(ehCampusDestaque("CAMPUS VENÂNCIO AIRES")).toBe(true);
    expect(ehCampusDestaque("Campus Venancio Aires")).toBe(true);
    expect(ehCampusDestaque("CAMPUS PELOTAS")).toBe(false);
  });

  it("põe o Venâncio Aires na frente e mantém a ordem dos outros câmpus", async () => {
    const { campusDestaqueNaFrente } = await import("@/lib/destaque");
    const lista = [{ n: "CAMPUS BAGÉ" }, { n: "CAMPUS PELOTAS" }, { n: "CAMPUS VENÂNCIO AIRES" }, { n: "CAMPUS CAMAQUÃ" }];
    expect(campusDestaqueNaFrente(lista, (i) => i.n).map((i) => i.n)).toEqual(["CAMPUS VENÂNCIO AIRES", "CAMPUS BAGÉ", "CAMPUS PELOTAS", "CAMPUS CAMAQUÃ"]);
  });
});
