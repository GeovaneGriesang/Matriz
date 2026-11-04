import { describe, expect, it } from "vitest";
import { destaqueNaFrente, ehInstituicaoDestaque } from "@/lib/destaque";
import { FICHAS_DAS_TELAS, PERGUNTAS_DO_GUIA } from "@/lib/guiaDasTelas";
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
  it("o Guia das telas explica toda tela do menu (só ele mesmo não tem ficha)", () => {
    const semFicha = TODOS_OS_ITENS.map((i) => i.href).filter((h) => !FICHAS_DAS_TELAS[h]);
    expect(semFicha).toEqual(["/como-funciona/telas"]);
    for (const p of PERGUNTAS_DO_GUIA) expect(FICHAS_DAS_TELAS[p.href]).toBeDefined();
  });

  it("não repete endereço entre os itens", () => {
    const enderecos = TODOS_OS_ITENS.map((i) => i.href);
    expect(new Set(enderecos).size).toBe(enderecos.length);
  });

  it("todo item tem uma frase dizendo o que se faz na tela", () => {
    for (const g of GRUPOS_MENU) for (const i of g.itens) expect(i.descricao.length).toBeGreaterThan(20);
  });

  it("o simulador do integrado de 3 ou 4 anos é aba de Quanto vale um curso, no grupo E se...?", () => {
    const melhorar = GRUPOS_MENU.find((g) => g.id === "e-se")!;
    expect(melhorar.itens.some((i) => i.abas?.includes("/simulador/curso"))).toBe(true);
  });

  it("as três perguntas têm duas telas cada; o perfil padrão não vê as telas técnicas de Mais; a distribuição aparece para todos os perfis", async () => {
    const { gruposVisiveis } = await import("@/lib/menu");
    const ids = (papel: "PADRAO" | "ADMIN" | "SUPER_ADMIN") => gruposVisiveis(papel).map((g) => g.id);
    const itens = (papel: "PADRAO" | "ADMIN" | "SUPER_ADMIN") => gruposVisiveis(papel).flatMap((g) => g.itens.map((i) => i.href));
    const principais = ["recebemos", "confiar", "e-se", "mais", "como-funciona"];
    expect(ids("PADRAO")).toEqual(principais);
    expect(ids("ADMIN")).toEqual(principais);
    for (const id of ["recebemos", "confiar", "e-se"]) expect(GRUPOS_MENU.find((g) => g.id === id)!.itens).toHaveLength(2);
    expect(itens("PADRAO")).not.toContain("/evasao");
    expect(itens("ADMIN")).toContain("/evasao");
    expect(itens("PADRAO")).toContain("/situacao-dos-dados");
    for (const papel of ["PADRAO", "ADMIN", "SUPER_ADMIN"] as const) expect(itens(papel)).toContain("/simulador/distribuicao");
  });

  it("marca o item de endereço mais longo, não o prefixo", () => {
    // "/simulador/curso" e "/simulador/novo-curso" são abas de "Quanto vale um curso".
    expect(itemAtivo("/simulador/curso")?.href).toBe("/consulta/curso");
    expect(itemAtivo("/simulador/novo-curso")?.href).toBe("/consulta/curso");
    expect(itemAtivo("/consulta/curso")?.href).toBe("/consulta/curso");
    // "/simulador" e "/simulador/oportunidades" são abas de "Onde o câmpus pode ganhar".
    expect(itemAtivo("/simulador")?.href).toBe("/simulador/alternativas");
    expect(itemAtivo("/simulador/oportunidades")?.href).toBe("/simulador/alternativas");
    expect(itemAtivo("/simulador/projecao")?.href).toBe("/simulador/projecao");
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

describe("ordem do menu", () => {
  it("as telas de cada grupo estão em ordem alfabética", () => {
    for (const g of GRUPOS_MENU) {
      const rotulos = g.itens.map((i) => i.rotulo);
      expect(rotulos).toEqual([...rotulos].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })));
    }
  });
});
