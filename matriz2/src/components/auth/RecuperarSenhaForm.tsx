"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { solicitarRecuperacaoSenhaAction } from "@/server/actions/usuarios";

export function RecuperarSenhaForm() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    const formData = new FormData(event.currentTarget);
    await solicitarRecuperacaoSenhaAction(formData);
    setEnviando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Se <strong>{email}</strong> tiver uma conta, um código chegou por e-mail. Use-o na tela a seguir.
        </p>
        <Link
          href={`/admin/definir-senha?email=${encodeURIComponent(email)}`}
          className="w-fit rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90"
        >
          Já tenho o código
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="w-fit rounded-md bg-if-green px-4 py-2 text-sm font-medium text-white hover:bg-if-green/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Enviando..." : "Enviar código"}
      </button>
    </form>
  );
}
