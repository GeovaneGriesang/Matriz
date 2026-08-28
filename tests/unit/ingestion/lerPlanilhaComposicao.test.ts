import { describe, it, expect } from "vitest";
import { lerPlanilhaComposicao } from "@/server/composicaoRepasse/lerPlanilhaComposicao";

const paraBuffer = (texto: string): ArrayBuffer => {
  const bytes = new TextEncoder().encode(texto);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

describe("lerPlanilhaComposicao (CSV)", () => {
  it("lê o formato exportado da planilha, com cabeçalho na primeira linha", async () => {
    const r = await lerPlanilhaComposicao(
      "c.csv",
      paraBuffer(
        "Modalidade;FonteFinanciamento;Repasse;Porcentagem\n" +
          "ENSINO A DISTANCIA;MOOC - Outros;EAD MOOC;0.08\n" +
          "ENSINO PRESENCIAL;E-TEC;PRESENCIAL;1\n",
      ),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[0]).toMatchObject({ fonte: "MOOC - Outros", repasse: "EAD MOOC", porcentagem: "0.08" });
  });

  it("acha o cabeçalho mesmo com linha de título antes (como no .xlsx da CONIF)", async () => {
    const r = await lerPlanilhaComposicao(
      "c.csv",
      paraBuffer(
        "Composição de Repasse;;;\n" +
          "Modalidade;Fonte de Financiamento;Repasse;Porcentagem\n" +
          "ENSINO A DISTANCIA;UAB;EAD;0,25\n",
      ),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linhas).toHaveLength(1);
    // A numeração aponta a linha real do arquivo (3ª), não a posição relativa ao cabeçalho.
    expect(r.linhas[0]).toMatchObject({ linha: 3, fonte: "UAB", porcentagem: "0,25" });
  });

  it('aceita "Fonte de Financiamento" e "FonteFinanciamento" como a mesma coluna', async () => {
    for (const cabecalho of ["Modalidade;Fonte de Financiamento;Repasse;Porcentagem", "Modalidade;FonteFinanciamento;Repasse;Porcentagem"]) {
      const r = await lerPlanilhaComposicao("c.csv", paraBuffer(`${cabecalho}\nEAD;X;EAD;0,25\n`));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.linhas[0]?.fonte).toBe("X");
    }
  });

  it("ignora linhas totalmente vazias (separadores visuais da planilha)", async () => {
    const r = await lerPlanilhaComposicao(
      "c.csv",
      paraBuffer("Modalidade;FonteFinanciamento;Repasse;Porcentagem\nEAD;X;EAD;0,25\n;;;\nEAD;Y;EAD;0,25\n"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linhas).toHaveLength(2);
  });

  it("recusa arquivo sem as colunas obrigatórias, explicando o que falta", async () => {
    const r = await lerPlanilhaComposicao("c.csv", paraBuffer("Coluna A;Coluna B\n1;2\n"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("colunas obrigatórias");
  });

  it("aceita vírgula como delimitador, além de ponto-e-vírgula", async () => {
    const r = await lerPlanilhaComposicao(
      "c.csv",
      paraBuffer("Modalidade,FonteFinanciamento,Repasse,Porcentagem\nEAD,MOOC - Outros,EAD MOOC,0.08\n"),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.linhas[0]?.repasse).toBe("EAD MOOC");
  });

  it("não confunde a coluna Repasse com a Modalidade quando a ordem muda", async () => {
    const r = await lerPlanilhaComposicao(
      "c.csv",
      paraBuffer("Repasse;Porcentagem;Modalidade;FonteFinanciamento\nEAD MOOC;0,08;ENSINO A DISTANCIA;MOOC - Outros\n"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.linhas[0]).toMatchObject({
      modalidade: "ENSINO A DISTANCIA",
      fonte: "MOOC - Outros",
      repasse: "EAD MOOC",
      porcentagem: "0,08",
    });
  });
});
