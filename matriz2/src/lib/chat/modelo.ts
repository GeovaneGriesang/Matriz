/**
 * O nome do modelo de linguagem em uso, como a pessoa lê na tela do chat. Fica num lugar só: o painel do chat, a instrução dada ao próprio
 * modelo (para ele saber responder "que IA é você?") e o registro de cada conversa usam este texto.
 *
 * Dois provedores (decisão de 2026-10-25): com GEMINI_API_KEY no ambiente, o chat usa o Gemini do Google (nível gratuito); sem ela, ou
 * com CHAT_PROVEDOR=ollama, usa o modelo local do servidor (OLLAMA_MODEL). Os modelos do Gemini são tentados em ordem (GEMINI_MODELOS,
 * separados por vírgula): o Google às vezes recusa um por excesso de demanda (503) e aposenta os antigos para chaves novas (o 2.5 Flash
 * já não vale). Se todos falharem, ou o limite gratuito acabar, a rota cai sozinha para o modelo local.
 */

const ROTULOS: Record<string, string> = {
  "qwen2.5:3b-instruct": "Qwen 2.5, 3 bilhões de parâmetros (modelo livre da Alibaba), rodando no servidor do sistema",
  gemini: "Gemini, do Google (as perguntas e os dados da tela são enviados ao Google)",
};

export function usaGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.CHAT_PROVEDOR !== "ollama";
}

/** Os modelos do Gemini, na ordem em que o chat tenta: o recomendado primeiro, o mais leve por último. */
export function modelosGemini(): string[] {
  const lista = (process.env.GEMINI_MODELOS ?? "gemini-3.8-flash,gemini-flash-latest,gemini-flash-lite-latest")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : ["gemini-flash-lite-latest"];
}

export function idDoModeloGemini(): string {
  return modelosGemini()[0]!;
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
  return ROTULOS[id] ?? (id.startsWith("gemini") ? ROTULOS.gemini! : `${id}, rodando no servidor do sistema`);
}
