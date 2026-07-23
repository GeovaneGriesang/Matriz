import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET não está configurado.");
  }
  return secret;
}

function assinar(expiresAt: number): string {
  return createHmac("sha256", getSessionSecret()).update(String(expiresAt)).digest("hex");
}

/** Gera o valor do cookie de sessão do admin, válido por 8h a partir de agora. */
export function createSessionCookieValue(): string {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  return `${expiresAt}.${assinar(expiresAt)}`;
}

/** Valida assinatura e expiração de um valor de cookie de sessão. */
export function isValidSessionCookieValue(value: string | undefined): boolean {
  if (!value) return false;

  const [expiresAtRaw, assinatura] = value.split(".");
  if (!expiresAtRaw || !assinatura) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const esperada = assinar(expiresAt);
  const bufferRecebido = Buffer.from(assinatura);
  const bufferEsperado = Buffer.from(esperada);
  if (bufferRecebido.length !== bufferEsperado.length) return false;

  return timingSafeEqual(bufferRecebido, bufferEsperado);
}

export const ADMIN_SESSION_COOKIE_NAME = SESSION_COOKIE_NAME;
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_DURATION_MS / 1000;

/** Server Components/Layouts: true se a requisição tem uma sessão de admin válida. */
export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

/** Route Handlers: retorna uma resposta 401 se não autenticado, ou `null` se ok. */
export async function requireAdminSessionOrResponse(): Promise<NextResponse | null> {
  const autenticado = await getAdminSession();
  if (!autenticado) {
    return NextResponse.json({ errorMessage: "Não autenticado." }, { status: 401 });
  }
  return null;
}

/** Layouts de páginas admin: redireciona para o login se não houver sessão válida. */
export async function requireAdminOrRedirect(nextPath: string): Promise<void> {
  const autenticado = await getAdminSession();
  if (!autenticado) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}
