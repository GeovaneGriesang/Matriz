"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trocarMinhaSenhaAction } from "@/server/actions/usuarios";

/**
 * `trocaObrigatoria` vem de `precisaTrocarSenha` (senha gerada pelo sistema): depois
 * de trocar com sucesso, manda para uma tela que qualquer admin acessa (não só
 * super-admin), em vez de deixar a mensagem de sucesso parada aqui — a pessoa entrou
 * numa conta nova, ainda não tem motivo para ficar em "Minha conta".
 */
export function TrocarSenhaForm({ trocaObrigatoria = false }: { trocaObrigatoria?: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErro(null);
    setSucesso(false);

    const formData = new FormData(event.currentTarget);
    const resultado = await trocarMinhaSenhaAction(formData);

    if (resultado.ok) {
      if (trocaObrigatoria) {
        router.push("/admin/orcamento");
        router.refresh();
        return;
      }
      setEnviando(false);
      setSucesso(true);
      event.currentTarget.reset();
    } else {
      setEnviando(false);
      setErro(resultado.errorMessage ?? "Não foi possível trocar a senha.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Trocar senha</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="senhaAtual" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Senha atual
        </label>
        <input
          id="senhaAtual"
          name="senhaAtual"
          type="password"
          required
          autoComplete="current-password"
          disabled={enviando}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="senhaNova" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Nova senha
        </label>
        <input
          id="senhaNova"
          name="senhaNova"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={enviando}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Pelo menos 8 caracteres.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirmacao" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Confirmar nova senha
        </label>
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          required
          autoComplete="new-password"
          disabled={enviando}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      {erro && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
      )}
      {sucesso && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">
          Senha trocada.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-fit rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Trocando..." : "Trocar senha"}
      </button>
    </form>
  );
}
