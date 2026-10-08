import { temAcessoPleno } from "@/lib/permissoes";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getAdminSession } from "@/server/auth/session";
import { LIMITES_CHAT, montarMensagens, type EntradaChat, type TurnoChat } from "@/lib/chat/montarPrompt";
import { LimitePorUsuario, UmPorVez } from "@/lib/chat/limite";
import { idDoModelo, rotuloDoModelo } from "@/lib/chat/modelo";
import { respostaPronta } from "@/lib/chat/respostasProntas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const MODELO = idDoModelo();
/** Uma pessoa pode fazer 12 perguntas a cada 10 minutos. */
const limite = new LimitePorUsuario(12, 10 * 60_000);
/** Uma resposta por vez no servidor; se uma travar, a vez expira sozinha em 3 minutos. */
const vez = new UmPorVez(3 * 60_000);

function erro(mensagem: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ erro: mensagem, ...extra }, { status });
}

function lerEntrada(corpo: unknown): EntradaChat | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (typeof c.pergunta !== "string" || c.pergunta.trim().length === 0 || c.pergunta.length > LIMITES_CHAT.pergunta) return null;
  if (typeof c.rota !== "string" || !c.rota.startsWith("/") || c.rota.length > 120) return null;
  const historico: TurnoChat[] = [];
  if (Array.isArray(c.historico)) {
    for (const t of c.historico.slice(-LIMITES_CHAT.turnosDeHistorico)) {
      if (!t || typeof t !== "object") return null;
      const { papel, texto } = t as Record<string, unknown>;
      if ((papel !== "usuario" && papel !== "assistente") || typeof texto !== "string") return null;
      historico.push({ papel, texto });
    }
  }
  const contexto = typeof c.contexto === "string" ? c.contexto.slice(0, LIMITES_CHAT.contexto) : undefined;
  return { rota: c.rota, pergunta: c.pergunta, historico, contexto };
}

export async function POST(req: Request) {
  if (process.env.CHAT_ATIVO !== "1") return erro("O chat ainda não está ligado neste servidor.", 503);
  const usuario = await getAdminSession();
  if (!usuario || !temAcessoPleno(usuario.papel)) return erro("Não autenticado.", 401);

  let entrada: EntradaChat | null;
  try {
    entrada = lerEntrada(await req.json());
  } catch {
    entrada = null;
  }
  if (!entrada) return erro("Pergunta inválida.", 400);

  // Pergunta comum: resposta pronta, na hora, sem passar pelo modelo (nem pela fila e pelo limite, que protegem a CPU do servidor).
  const pronta = respostaPronta(entrada.pergunta, entrada.rota, rotuloDoModelo());
  if (pronta) {
    await prisma.conversaChat
      .create({ data: { usuarioId: usuario.id, rota: entrada.rota, pergunta: entrada.pergunta, resposta: pronta, modelo: "respostas-prontas", duracaoMs: 0, situacao: "pronta" } })
      .catch((e) => console.error("Chat: não consegui registrar a conversa.", e));
    return new Response(pronta, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Resposta-Pronta": "1" } });
  }

  if (!limite.tentar(usuario.id)) {
    return erro(`Você já fez muitas perguntas seguidas. Tente de novo em ${Math.ceil(limite.segundosParaLiberar(usuario.id) / 60)} minuto(s).`, 429);
  }
  const devolver = vez.tomar();
  if (!devolver) return erro("O assistente está respondendo a outra pergunta. Tente de novo em alguns segundos.", 429);

  const inicio = Date.now();
  let resposta = "";
  let situacao = "ok";
  let registrado = false;
  const registrar = async () => {
    if (registrado) return;
    registrado = true;
    devolver();
    try {
      await prisma.conversaChat.create({
        data: { usuarioId: usuario.id, rota: entrada!.rota, pergunta: entrada!.pergunta, resposta, modelo: MODELO, duracaoMs: Date.now() - inicio, situacao },
      });
    } catch (e) {
      console.error("Chat: não consegui registrar a conversa.", e);
    }
  };

  let origem: Response;
  try {
    origem = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO,
        messages: montarMensagens({ ...entrada, modelo: rotuloDoModelo() }),
        stream: true,
        keep_alive: "5m",
        options: { num_ctx: 4096, num_predict: 450, temperature: 0.2 },
      }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(150_000)]),
    });
  } catch {
    situacao = "erro";
    await registrar();
    return erro("Não consegui falar com o modelo de linguagem. Tente de novo em instantes.", 503);
  }
  if (!origem.ok || !origem.body) {
    situacao = "erro";
    const motivo = await origem.text().catch(() => "");
    await registrar();
    const semModelo = /not found|pull/i.test(motivo);
    return erro(semModelo ? "O modelo de linguagem ainda não foi instalado no servidor." : "O modelo de linguagem devolveu um erro.", 503);
  }

  // O Ollama manda uma linha de JSON por pedaço; ao navegador vai só o texto, que aparece enquanto é gerado.
  const leitor = origem.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let resto = "";
  const fluxo = new ReadableStream<Uint8Array>({
    async pull(controle) {
      try {
        const { done, value } = await leitor.read();
        if (done) {
          await registrar();
          controle.close();
          return;
        }
        resto += decoder.decode(value, { stream: true });
        const linhas = resto.split("\n");
        resto = linhas.pop() ?? "";
        for (const linha of linhas) {
          if (!linha.trim()) continue;
          const pedaco = (JSON.parse(linha) as { message?: { content?: string } }).message?.content ?? "";
          if (pedaco) {
            resposta += pedaco;
            controle.enqueue(encoder.encode(pedaco));
          }
        }
      } catch {
        situacao = req.signal.aborted ? "interrompida" : "erro";
        await registrar();
        controle.close();
      }
    },
    async cancel() {
      situacao = "interrompida";
      await leitor.cancel().catch(() => undefined);
      await registrar();
    },
  });
  return new Response(fluxo, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
