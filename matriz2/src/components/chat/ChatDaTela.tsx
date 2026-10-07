"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { itemAtivo } from "@/lib/menu";

interface Turno {
  papel: "usuario" | "assistente";
  texto: string;
  /** Resposta pronta (escrita pela equipe), e não gerada pelo modelo de linguagem. */
  pronta?: boolean;
}

const ContextoDoChat = createContext<{ definir: (texto: string) => void } | null>(null);
const TextoDoContexto = createContext<string>("");

/** Guarda o que a tela aberta está mostrando, para o chat poder comentar os números que a pessoa está vendo. */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [texto, setTexto] = useState("");
  const definir = useCallback((t: string) => setTexto(t), []);
  return (
    <ContextoDoChat.Provider value={{ definir }}>
      <TextoDoContexto.Provider value={texto}>{children}</TextoDoContexto.Provider>
    </ContextoDoChat.Provider>
  );
}

/** Uma tela usa isto para entregar ao chat um resumo do que mostra (filtros e números principais, em texto curto). Não desenha nada. */
export function ContextoDaTela({ texto }: { texto: string }) {
  const ctx = useContext(ContextoDoChat);
  useEffect(() => {
    ctx?.definir(texto);
    return () => ctx?.definir("");
  }, [ctx, texto]);
  return null;
}

const SUGESTOES = ["O que esta tela mostra?", "Como o valor é calculado?", "O que significa a marca Estimado?"];

/** Botão flutuante e painel de conversa com o assistente. Só é montado para quem tem acesso pleno e quando o chat está ligado. */
export function ChatDaTela({ modelo }: { modelo: string }) {
  const pathname = usePathname();
  const contexto = useContext(TextoDoContexto);
  const tela = itemAtivo(pathname);
  const [aberto, setAberto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const abortar = useRef<AbortController | null>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos, aberto]);

  async function perguntar(texto: string) {
    const t = texto.trim();
    if (!t || carregando) return;
    setAviso("");
    setPergunta("");
    const historico = turnos;
    setTurnos([...historico, { papel: "usuario", texto: t }, { papel: "assistente", texto: "" }]);
    setCarregando(true);
    const controle = new AbortController();
    abortar.current = controle;
    try {
      const r = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rota: pathname, pergunta: t, historico: historico.map(({ papel, texto }) => ({ papel, texto })), contexto }),
        signal: controle.signal,
      });
      if (!r.ok || !r.body) {
        const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
        setAviso(corpo?.erro ?? "Não consegui responder agora.");
        setTurnos((atual) => atual.slice(0, -1));
        return;
      }
      const pronta = r.headers.get("X-Resposta-Pronta") === "1";
      const leitor = r.body.getReader();
      const decoder = new TextDecoder();
      let acumulado = "";
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        acumulado += decoder.decode(value, { stream: true });
        setTurnos((atual) => [...atual.slice(0, -1), { papel: "assistente", texto: acumulado, pronta }]);
      }
      if (!acumulado.trim()) setAviso("O assistente não devolveu resposta. Tente reformular a pergunta.");
    } catch {
      if (!controle.signal.aborted) setAviso("A conexão caiu antes do fim da resposta.");
    } finally {
      setCarregando(false);
      abortar.current = null;
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="nao-imprimir fixed bottom-5 right-5 z-40 rounded-full bg-if-green px-4 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90"
      >
        Perguntar sobre esta tela
      </button>
    );
  }

  return (
    <section
      aria-label="Assistente da matriz"
      className="nao-imprimir fixed bottom-5 right-5 z-40 flex h-[32rem] max-h-[calc(100vh-6rem)] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-lg border border-neutral-300 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
    >
      <header className="flex items-start justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Assistente da matriz</span>
          <span className="text-xs text-neutral-500">{tela ? `Tela: ${tela.rotulo}` : "Pergunte sobre o sistema"}</span>
          <span className="text-xs text-neutral-500">Modelo: {modelo}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            abortar.current?.abort();
            setAberto(false);
          }}
          className="rounded px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          aria-label="Fechar o assistente"
        >
          Fechar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2 text-sm">
        {turnos.length === 0 && (
          <div className="flex flex-col gap-2 text-neutral-600 dark:text-neutral-400">
            <p>
              Eu explico esta tela e a regra da matriz. Sou um modelo pequeno e posso errar: confira os números na tela e, na dúvida, veja a página "Como funciona".
            </p>
            <div className="flex flex-wrap gap-1">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => perguntar(s)}
                  className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {turnos.map((t, i) => (
            <div
              key={i}
              className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 ${
                t.papel === "usuario" ? "self-end bg-if-green text-white" : "self-start bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              }`}
            >
              {t.texto || (carregando && i === turnos.length - 1 ? "Pensando..." : "")}
              {t.pronta && <span className="mt-1 block text-xs opacity-70">Resposta pronta, escrita pela equipe (não é gerada pela IA).</span>}
            </div>
          ))}
        </div>
        {aviso && <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{aviso}</p>}
        <div ref={fim} />
      </div>

      <form
        className="flex gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800"
        onSubmit={(e) => {
          e.preventDefault();
          void perguntar(pergunta);
        }}
      >
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          maxLength={800}
          placeholder="Escreva sua pergunta"
          className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        {carregando ? (
          <button type="button" onClick={() => abortar.current?.abort()} className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
            Parar
          </button>
        ) : (
          <button type="submit" disabled={!pergunta.trim()} className="rounded bg-if-green px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Enviar
          </button>
        )}
      </form>
    </section>
  );
}
