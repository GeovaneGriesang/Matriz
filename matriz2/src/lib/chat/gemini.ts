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

/** Tenta os modelos em ordem e devolve o primeiro que aceitar a pergunta, com o nome dele (para o registro da conversa). */
export async function chamarGeminiEmOrdem(
  mensagens: MensagemOllama[],
  modelos: string[],
  chave: string,
  sinal: AbortSignal,
): Promise<{ leitor: ReadableStreamDefaultReader<Uint8Array>; modelo: string } | null> {
  for (const modelo of modelos) {
    if (sinal.aborted) return null;
    const leitor = await chamarGemini(mensagens, modelo, chave, sinal);
    if (leitor) return { leitor, modelo };
  }
  return null;
}

export async function chamarGemini(
  mensagens: MensagemOllama[],
  modelo: string,
  chave: string,
  sinal: AbortSignal,
): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
  // Espera no máximo 20 s pelo começo da resposta: um modelo travado não segura a pergunta, e o próximo da lista é tentado.
  // Começada a resposta, o prazo deixa de valer (o texto pode continuar chegando aos pedaços).
  const prazo = new AbortController();
  const relogio = setTimeout(() => prazo.abort(), 20_000);
  try {
    const resposta = await fetch(`${URL_BASE}/${encodeURIComponent(modelo)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify(paraGemini(mensagens)),
      signal: AbortSignal.any([sinal, prazo.signal]),
    });
    clearTimeout(relogio);
    if (!resposta.ok || !resposta.body) {
      console.error(`Chat: o Gemini (${modelo}) respondeu ${resposta.status}; tentando o próximo.`);
      return null;
    }
    return resposta.body.getReader();
  } catch (e) {
    clearTimeout(relogio);
    console.error(`Chat: não consegui falar com o Gemini (${modelo}); tentando o próximo.`, e instanceof Error ? e.message : e);
    return null;
  }
}
