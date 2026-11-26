import { describe, expect, it } from "vitest";
import { arquivosDaPagina, diferencas } from "@/lib/fontes/leituraDeFontes";

describe("verificação das fontes", () => {
  it("acha os arquivos publicados numa página e ignora carimbos de horário", () => {
    const html = `<a href="/upload/loa-2027.pdf">LOA</a> <a href="arquivo?link=60552">anexo</a> <a href="/noticias">x</a>
      <a href="https://legis.senado.gov.br/sdleg-getter/documento/download/abc?ts=1795702135180&amp;disposition=inline">doc</a>`;
    expect(arquivosDaPagina(html, "https://exemplo.gov.br/orcamento")).toEqual([
      "https://exemplo.gov.br/arquivo?link=60552",
      "https://exemplo.gov.br/upload/loa-2027.pdf",
      "https://legis.senado.gov.br/sdleg-getter/documento/download/abc",
    ]);
  });

  it("diz o que entrou e o que saiu", () => {
    expect(diferencas(["a", "b"], ["b", "c"])).toBe("Novo (1):\nc\n\nSaiu (1):\na");
    expect(diferencas(["a"], ["a"])).toBe("");
  });
});
