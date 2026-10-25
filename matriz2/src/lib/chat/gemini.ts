import type { MensagemOllama } from "./montarPrompt";

/**
 * A chamada ao Gemini (API do Google AI Studio), com a resposta chegando aos pedaços (streaming por SSE). Recebe as mesmas mensagens
 * montadas para o modelo local e as converte: a de sistema vira a instrução do sistema; "assistant" vira "model".
 * Devolve null quando o Gemini não responde bem (chave errada, limite gratuito esgotado, fora do ar): a rota cai para o modelo local.
 */

const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function paraGemini(mensagens: MensagemOllama[]) {
  const sistema = mensagens.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = mensagens
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return {
    ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
  };
}

/** Um pedaço de texto de um evento SSE do Gemini ("data: {...}"), ou "" se o evento não traz texto. */
export function textoDoEvento(linha: string): string {
  if (!linha.startsWith("data:")) return "";
  try {
    const dado = JSON.parse(linha.slice(5).trim()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return (dado.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  } catch {
    return "";
  }
}

export async function chamarGemini(
  mensagens: MensagemOllama[],
  modelo: string,
  chave: string,
  sinal: AbortSignal,
): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
  try {
    const resposta = await fetch(`${URL_BASE}/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify(paraGemini(mensagens)),
      signal: sinal,
    });
    if (!resposta.ok || !resposta.body) {
      console.error(`Chat: o Gemini respondeu ${resposta.status}; caindo para o modelo local.`);
      return null;
    }
    return resposta.body.getReader();
  } catch (e) {
    console.error("Chat: não consegui falar com o Gemini; caindo para o modelo local.", e instanceof Error ? e.message : e);
    return null;
  }
}
