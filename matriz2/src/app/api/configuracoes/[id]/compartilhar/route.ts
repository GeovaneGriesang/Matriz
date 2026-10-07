import { NextResponse } from "next/server";
import { compartilhar } from "@/server/configuracoes";
import { atorDaSessao, corpoJson, idDaRota, naoAutenticado, responder } from "@/server/configuracoesHttp";

export const dynamic = "force-dynamic";

/** PUT { usuarioIds: number[] }: com quem a simulação é compartilhada (substitui a lista anterior). Só o dono. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ator = await atorDaSessao();
  if (!ator) return naoAutenticado();
  const id = idDaRota((await params).id);
  const corpo = await corpoJson(req);
  if (!id || !corpo) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  return responder(await compartilhar(ator, id, corpo.usuarioIds));
}
