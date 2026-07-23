"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/server/actions/adminAuth";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErro(null);

    const formData = new FormData(event.currentTarget);
    const resultado = await loginAction(formData);

    if (resultado.ok) {
      router.push(searchParams.get("next") ?? "/upload");
      router.refresh();
    } else {
      setErro(resultado.errorMessage ?? "Não foi possível entrar.");
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Senha de administrador
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          disabled={enviando}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>

      {erro && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">{erro}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
