/**
 * O nome do modelo de linguagem em uso, como a pessoa lê na tela do chat. Fica num lugar só: o painel do chat, a instrução dada ao próprio
 * modelo (para ele saber responder "que IA é você?") e o registro de cada conversa usam este texto. Para trocar de modelo, basta mudar as
 * variáveis de ambiente OLLAMA_MODEL e, se quiser outro texto, CHAT_MODELO_ROTULO.
 */

const ROTULOS: Record<string, string> = {
  "qwen2.5:3b-instruct": "Qwen 2.5, 3 bilhões de parâmetros (modelo livre da Alibaba), rodando no servidor do sistema",
};

export function idDoModelo(): string {
  return process.env.OLLAMA_MODEL ?? "qwen2.5:3b-instruct";
}

export function rotuloDoModelo(): string {
  return process.env.CHAT_MODELO_ROTULO ?? ROTULOS[idDoModelo()] ?? `${idDoModelo()}, rodando no servidor do sistema`;
}
