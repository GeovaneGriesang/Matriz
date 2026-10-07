import { NextResponse } from "next/server";
import { criar, listar } from "@/server/configuracoes";
import { atorDaSessao, corpoJson, naoAutenticado, responder } from "@/server/configuracoesHttp";

export const dynamic = "force-dynamic";

/** GET /api/configuracoes?tela=...: as simulações e consultas salvas de uma tela que a pessoa pode ver. */
export async function GET(req: Request) {
  const ator = await atorDaSessao();
  if (!ator) return naoAutenticado();
  const tela = new URL(req.url).searchParams.get("tela") ?? "";
  return responder(await listar(ator, tela));
}

/** POST /api/configuracoes: salva uma simulação ou consulta nova, do usuário da sessão. */
export async function POST(req: Request) {
  const ator = await atorDaSessao();
  if (!ator) return naoAutenticado();
  const corpo = await corpoJson(req);
  if (!corpo) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  return responder(await criar(ator, { tela: corpo.tela, nome: corpo.nome, dados: corpo.dados }));
}
