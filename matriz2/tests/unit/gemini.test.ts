import { describe, expect, it } from "vitest";
import { paraGemini, textoDoEvento } from "@/lib/chat/gemini";

describe("conversão das mensagens para o Gemini", () => {
  it("a mensagem de sistema vira instrução do sistema e o assistente vira 'model'", () => {
    const corpo = paraGemini([
      { role: "system", content: "Você explica a matriz." },
      { role: "user", content: "O que é ICQA?" },
      { role: "assistant", content: "É a fração de alunos que conta." },
      { role: "user", content: "E o peso?" },
    ]);
    expect(corpo.systemInstruction?.parts[0]?.text).toBe("Você explica a matriz.");
    expect(corpo.contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(corpo.contents[2]?.parts[0]?.text).toBe("E o peso?");
  });

  it("lê o texto de um evento SSE e ignora o que não é dado", () => {
    expect(textoDoEvento('data: {"candidates":[{"content":{"parts":[{"text":"Olá"},{"text":"!"}]}}]}')).toBe("Olá!");
    expect(textoDoEvento("")).toBe("");
    expect(textoDoEvento("data: não é json")).toBe("");
  });
});
