import { describe, expect, it } from "vitest";
import { GRUPOS_MENU, ajustesDasMarcacoes, chaveDaMarcacao, gruposVisiveis, marcacoesAtuais, visivelNaPreConfiguracao, type AjusteDeTela } from "@/lib/menu";
import { podeEscolherTelasDosPerfis } from "@/lib/permissoes";

const telasDe = (grupos: ReturnType<typeof gruposVisiveis>) => grupos.flatMap((g) => g.itens.map((i) => i.href));
const todas = GRUPOS_MENU.flatMap((g) => g.itens);

describe("telas por perfil", () => {
  it("sem ajuste, cada perfil vê o mesmo que via antes da configuração", () => {
    const tecnicas = todas.filter((i) => i.somenteAdmin).map((i) => i.href);
    expect(tecnicas).toHaveLength(7);
    expect(telasDe(gruposVisiveis("ADMIN"))).toEqual(todas.map((i) => i.href));
    expect(telasDe(gruposVisiveis("SUPER_ADMIN"))).toEqual(todas.map((i) => i.href));
    expect(telasDe(gruposVisiveis("PADRAO"))).toEqual(todas.map((i) => i.href).filter((h) => !tecnicas.includes(h)));
  });

  it("o ajuste dá e tira tela de um perfil, sem mexer no outro", () => {
    const ajustes: AjusteDeTela[] = [
      { papel: "PADRAO", href: "/pnp", visivel: true },
      { papel: "PADRAO", href: "/comparativo", visivel: false },
    ];
    const padrao = telasDe(gruposVisiveis("PADRAO", ajustes));
    expect(padrao).toContain("/pnp");
    expect(padrao).not.toContain("/comparativo");
    expect(telasDe(gruposVisiveis("ADMIN", ajustes))).toEqual(telasDe(gruposVisiveis("ADMIN")));
  });

  it("o super-admin vê todas as telas, mesmo com ajuste gravado para ele por engano", () => {
    const ajustes = [{ papel: "SUPER_ADMIN", href: "/consulta", visivel: false }] as unknown as AjusteDeTela[];
    expect(telasDe(gruposVisiveis("SUPER_ADMIN", ajustes))).toContain("/consulta");
  });

  it("grupo sem nenhuma tela some do menu", () => {
    const recebemos = GRUPOS_MENU.find((g) => g.id === "recebemos")!;
    const ajustes = recebemos.itens.map((i) => ({ papel: "PADRAO" as const, href: i.href, visivel: false }));
    expect(gruposVisiveis("PADRAO", ajustes).some((g) => g.id === "recebemos")).toBe(false);
  });

  it("a pré-configuração marcada não grava nada, e só a diferença é gravada", () => {
    expect(ajustesDasMarcacoes(marcacoesAtuais([]))).toEqual([]);
    const marcadas = new Set(marcacoesAtuais([]));
    marcadas.delete(chaveDaMarcacao("ADMIN", "/evasao"));
    expect(ajustesDasMarcacoes(marcadas)).toEqual([{ papel: "ADMIN", href: "/evasao", visivel: false }]);
  });

  it("as marcações voltam iguais ao que foi gravado", () => {
    const ajustes: AjusteDeTela[] = [
      { papel: "ADMIN", href: "/evasao", visivel: false },
      { papel: "PADRAO", href: "/pnp", visivel: true },
    ];
    expect(ajustesDasMarcacoes(marcacoesAtuais(ajustes))).toEqual(ajustes);
  });

  it("marcação de tela que não existe é ignorada", () => {
    expect(ajustesDasMarcacoes([...marcacoesAtuais([]), "PADRAO|/nao-existe", "SUPER_ADMIN|/consulta"])).toEqual([]);
  });

  it("a pré-configuração do perfil padrão não inclui as telas técnicas", () => {
    const pnp = todas.find((i) => i.href === "/pnp")!;
    expect(visivelNaPreConfiguracao(pnp, "ADMIN")).toBe(true);
    expect(visivelNaPreConfiguracao(pnp, "PADRAO")).toBe(false);
  });

  it("só o super-admin escolhe as telas", () => {
    expect(podeEscolherTelasDosPerfis("SUPER_ADMIN")).toBe(true);
    expect(podeEscolherTelasDosPerfis("ADMIN")).toBe(false);
    expect(podeEscolherTelasDosPerfis("PADRAO")).toBe(false);
  });
});
