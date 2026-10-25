/**
 * O nome do modelo de linguagem em uso, como a pessoa lê na tela do chat. Fica num lugar só: o painel do chat, a instrução dada ao próprio
 * modelo (para ele saber responder "que IA é você?") e o registro de cada conversa usam este texto.
 *
 * Dois provedores (decisão de 2026-10-25): com GEMINI_API_KEY no ambiente, o chat usa o Gemini do Google (nível gratuito, modelo em
 * GEMINI_MODEL, padrão gemini-2.5-flash); sem ela, ou com CHAT_PROVEDOR=ollama, usa o modelo local do servidor (OLLAMA_MODEL). Quando o
 * Gemini falha ou o limite gratuito acaba, a rota do chat cai sozinha para o modelo local.
 */

const ROTULOS: Record<string, string> = {
  "qwen2.5:3b-instruct": "Qwen 2.5, 3 bilhões de parâmetros (modelo livre da Alibaba), rodando no servidor do sistema",
  "gemini-2.5-flash": "Gemini 2.5 Flash, do Google (as perguntas e os dados da tela são enviados ao Google)",
};

export function usaGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.CHAT_PROVEDOR !== "ollama";
}

export function idDoModeloGemini(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export function idDoModeloLocal(): string {
  return process.env.OLLAMA_MODEL ?? "qwen2.5:3b-instruct";
}

/** O modelo principal: o Gemini quando há chave, senão o local. */
export function idDoModelo(): string {
  return usaGemini() ? idDoModeloGemini() : idDoModeloLocal();
}

export function rotuloDoModelo(id: string = idDoModelo()): string {
  if (process.env.CHAT_MODELO_ROTULO && id === idDoModelo()) return process.env.CHAT_MODELO_ROTULO;
  return ROTULOS[id] ?? (id.startsWith("gemini") ? `${id}, do Google (as perguntas e os dados da tela são enviados ao Google)` : `${id}, rodando no servidor do sistema`);
}
