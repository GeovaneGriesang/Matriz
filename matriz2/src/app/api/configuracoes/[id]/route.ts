import { NextResponse } from "next/server";
import { atualizar, excluir, obter } from "@/server/configuracoes";
import { atorDaSessao, corpoJson, idDaRota, naoAutenticado, responder } from "@/server/configuracoesHttp";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/** GET: uma simulação inteira, com os dados, se a pessoa pode vê-la. */
export async function GET(_req: Request, { params }: Contexto) {
  const ator = await atorDaSessao();
  if (!ator) return naoAutenticado();
  const id = idDaRota((await params).id);
  if (!id) return NextResponse.json({ erro: "Simulação inválida." }, { status: 400 });
  return responder(await obter(ator, id));
}

/** PUT: salva por cima e/ou renomeia (só o dono), informando a versão que foi carregada; se outra pessoa salvou no meio, devolve 409. */
export async function PUT(req: Request, { params }: Contexto) {
  const ator = await atorDaSessao();
  if (!ator) return naoAutenticado();
  const id = idDaRota((await params).id);
  const corpo = await corpoJson(req);
  if (!id || !corpo) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  return responder(await atualizar(ator, id, { versaoEsperada: corpo.versaoEsperada, nome: corpo.nome, dados: corpo.dados }));
}

/** DELETE: o dono ou o super-administrador. */
export async function DELETE(_req: Request, { params }: Contexto) {
  const ator = await atorDaSessao();
  if (!ator) return naoAutenticado();
  const id = idDaRota((await params).id);
  if (!id) return NextResponse.json({ erro: "Simulação inválida." }, { status: 400 });
  return responder(await excluir(ator, id));
}
