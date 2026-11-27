"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { pedirAcessoAction } from "@/server/actions/pedidosAcesso";
import { DOMINIO_INSTITUCIONAL, ehEmailInstitucional, MENSAGEM_SO_INSTITUCIONAL } from "@/lib/emailInstitucional";

const CAMPO =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const ROTULO = "text-sm font-medium text-neutral-900 dark:text-neutral-100";

export function PedirAcessoForm({ unidades, unidadeMarcada }: { unidades: { id: number; nome: string }[]; unidadeMarcada?: number }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    // A mesma conferência é feita no servidor; aqui só poupa o envio.
    if (!ehEmailInstitucional(email)) {
      setErro(MENSAGEM_SO_INSTITUCIONAL);
      return;
    }
    setEnviando(true);
    const resultado = await pedirAcessoAction(formData);
    setEnviando(false);
    if (resultado.ok) setEnviadoPara(email);
    else setErro(resultado.errorMessage ?? "Não foi possível enviar o pedido.");
  }

  if (enviadoPara) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-if-green bg-green-50 p-6 text-sm text-neutral-800 dark:bg-green-950 dark:text-neutral-200">
        <p>
          Pedido recebido. Assim que ele for analisado, a resposta chega em <strong>{enviadoPara}</strong>. Se for aprovado, o e-mail traz o código para
          você criar a sua senha.
        </p>
        <Link href="/admin/login" className="w-fit font-medium text-if-green underline hover:text-if-green/80 dark:text-green-400">
          Voltar para a entrada
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className={ROTULO}>
          Nome completo
        </label>
        <input id="nome" name="nome" required maxLength={120} autoComplete="name" disabled={enviando} className={CAMPO} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className={ROTULO}>
          E-mail institucional
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={`nome.sobrenome@${DOMINIO_INSTITUCIONAL}`}
          disabled={enviando}
          className={CAMPO}
        />
        <span className="text-xs text-neutral-500">Só e-mail @{DOMINIO_INSTITUCIONAL}. Pedidos com outro e-mail não são aceitos.</span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="unidadeId" className={ROTULO}>
          Câmpus em que você trabalha
        </label>
        <select id="unidadeId" name="unidadeId" required defaultValue={unidadeMarcada ?? ""} disabled={enviando} className={CAMPO}>
          <option value="" disabled>
            Escolha
          </option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">O câmpus abre as telas próprias dele, como o orçamento do município para quem é de Venâncio Aires.</span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="motivo" className={ROTULO}>
          Setor, cargo ou motivo do pedido <span className="font-normal text-neutral-500">(opcional)</span>
        </label>
        <textarea id="motivo" name="motivo" rows={2} maxLength={500} disabled={enviando} className={CAMPO} />
      </div>
      {/* Escondido de quem usa a tela; só robôs de formulário preenchem. */}
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      {erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="w-fit rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Enviando..." : "Enviar pedido"}
      </button>
    </form>
  );
}
