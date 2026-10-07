import { destinatarios } from "@/server/configuracoes";
import { atorDaSessao, naoAutenticado, responder } from "@/server/configuracoesHttp";

export const dynamic = "force-dynamic";

/** GET: os usuários com quem se pode compartilhar uma simulação (ativos, com acesso pleno, menos a própria pessoa). */
export async function GET() {
  const ator = await atorDaSessao();
  if (!ator) return naoAutenticado();
  return responder(await destinatarios(ator));
}
