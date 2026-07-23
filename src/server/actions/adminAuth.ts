"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createSessionCookieValue,
} from "@/server/auth/session";

export interface LoginActionResult {
  ok: boolean;
  errorMessage?: string;
}

function senhaConfere(digitada: string, esperada: string): boolean {
  const bufferDigitada = Buffer.from(digitada);
  const bufferEsperada = Buffer.from(esperada);
  if (bufferDigitada.length !== bufferEsperada.length) return false;
  return timingSafeEqual(bufferDigitada, bufferEsperada);
}

/** Server Action que autentica o administrador e grava o cookie de sessão. */
export async function loginAction(formData: FormData): Promise<LoginActionResult> {
  const senha = formData.get("password");
  const senhaEsperada = process.env.ADMIN_PASSWORD;

  if (!senhaEsperada) {
    return { ok: false, errorMessage: "ADMIN_PASSWORD não está configurado no servidor." };
  }
  if (typeof senha !== "string" || senha.length === 0 || !senhaConfere(senha, senhaEsperada)) {
    return { ok: false, errorMessage: "Senha incorreta." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true };
}

/** Server Action que encerra a sessão de admin e redireciona para o login. */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
