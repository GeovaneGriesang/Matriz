import { describe, expect, it } from "vitest";
import { LimitePorUsuario, UmPorVez } from "@/lib/chat/limite";
import { LIMITES_CHAT, montarMensagens } from "@/lib/chat/montarPrompt";
import { CONHECIMENTO_GERAL, CONHECIMENTO_POR_TELA, conhecimentoDaTela } from "@/lib/chat/conhecimento";
import { TODOS_OS_ITENS } from "@/lib/menu";

describe("montarMensagens", () => {
  it("começa pelas instruções com o conhecimento geral, a tela aberta e os dados da tela, e termina na pergunta", () => {
    const m = montarMensagens({ rota: "/simulador/projecao", pergunta: "Quanto cai em 2031?", historico: [], contexto: "2031: R$ 100" });
    expect(m[0]!.role).toBe("system");
    expect(m[0]!.content).toContain(CONHECIMENTO_GERAL.slice(0, 40));
    expect(m[0]!.content).toContain("Cinco anos à frente");
    expect(m[0]!.content).toContain("DADOS DA TELA");
    expect(m[0]!.content).toContain("2031: R$ 100");
    expect(m.at(-1)).toEqual({ role: "user", content: "Quanto cai em 2031?" });
  });

  it("inclui o nome do modelo quando vem, para o assistente saber dizer que IA é", () => {
    const m = montarMensagens({ rota: "/", pergunta: "Que IA é você?", historico: [], modelo: "Modelo Teste" });
    expect(m[0]!.content).toContain("MODELO DE LINGUAGEM EM USO: Modelo Teste");
  });

  it("sem dados da tela, não cria a seção", () => {
    const m = montarMensagens({ rota: "/", pergunta: "Oi", historico: [] });
    expect(m[0]!.content).not.toContain("DADOS DA TELA");
  });

  it("guarda só os últimos turnos e corta texto longo", () => {
    const historico = Array.from({ length: 10 }, (_, i) => ({ papel: (i % 2 === 0 ? "usuario" : "assistente") as "usuario" | "assistente", texto: `t${i}` }));
    const m = montarMensagens({ rota: "/", pergunta: "x".repeat(LIMITES_CHAT.pergunta + 500), historico, contexto: "c".repeat(LIMITES_CHAT.contexto + 500) });
    expect(m.length).toBe(1 + LIMITES_CHAT.turnosDeHistorico + 1);
    expect(m.at(-1)!.content.length).toBeLessThanOrEqual(LIMITES_CHAT.pergunta + 3);
    expect(m[0]!.content.length).toBeLessThan(CONHECIMENTO_GERAL.length + LIMITES_CHAT.contexto + 3000);
    expect(m[1]!.role).toBe("user");
  });

  it("o texto de instruções proíbe inventar número", () => {
    expect(montarMensagens({ rota: "/", pergunta: "a", historico: [] })[0]!.content).toMatch(/Nunca invente número/);
  });
});

describe("conhecimento", () => {
  it("cada tela do menu tem texto próprio ou herda o da tela mais próxima", () => {
    for (const item of TODOS_OS_ITENS) expect(conhecimentoDaTela(item.href), item.href).not.toBe("");
  });

  it("a tela mais específica vence a mais genérica", () => {
    expect(conhecimentoDaTela("/simulador/projecao")).toBe(CONHECIMENTO_POR_TELA["/simulador/projecao"]);
    expect(conhecimentoDaTela("/simulador")).toBe(CONHECIMENTO_POR_TELA["/simulador"]);
  });

  it("o conhecimento geral cabe na janela de contexto de um modelo pequeno (cerca de 4 caracteres por token)", () => {
    expect(CONHECIMENTO_GERAL.length).toBeLessThan(5200);
  });
});

describe("LimitePorUsuario", () => {
  it("libera até o teto na janela e depois recusa, voltando a liberar quando a janela passa", () => {
    const l = new LimitePorUsuario(2, 1000);
    expect(l.tentar(1, 0)).toBe(true);
    expect(l.tentar(1, 100)).toBe(true);
    expect(l.tentar(1, 200)).toBe(false);
    expect(l.segundosParaLiberar(1, 200)).toBe(1);
    expect(l.tentar(2, 200)).toBe(true);
    expect(l.tentar(1, 1100)).toBe(true);
  });
});

describe("UmPorVez", () => {
  it("só uma geração por vez, e a vez expira sozinha se ninguém devolver", () => {
    const v = new UmPorVez(1000);
    const devolver = v.tomar(0);
    expect(devolver).not.toBeNull();
    expect(v.tomar(500)).toBeNull();
    devolver!();
    const segunda = v.tomar(600);
    expect(segunda).not.toBeNull();
    expect(v.tomar(700)).toBeNull();
    expect(v.tomar(1700)).not.toBeNull();
  });

  it("devolver a vez de uma geração antiga não libera a atual", () => {
    const v = new UmPorVez(1000);
    const antiga = v.tomar(0)!;
    const atual = v.tomar(1500)!;
    antiga();
    expect(v.tomar(1600)).toBeNull();
    atual();
    expect(v.tomar(1700)).not.toBeNull();
  });
});
