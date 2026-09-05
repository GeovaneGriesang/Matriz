import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";

/**
 * Sessão de administrador guardada no BANCO, não num cookie autocontido (o desenho
 * anterior desta sessão, com HMAC assinado). A diferença importa: um cookie
 * autocontido prova que foi emitido por nós, mas não pode ser revogado antes de
 * expirar, nem listado, nem auditado — e o usuário pediu exatamente essas três
 * coisas (sessões, auditoria, usuário e senha de verdade).
 *
 * O cookie carrega um token opaco de 32 bytes aleatórios. O banco guarda só o HASH
 * SHA-256 desse token, nunca o token em si: se o banco vazar, ninguém consegue
 * logar com o que está na tabela `Sessao`, precisa do valor original que só existe
 * no cookie do navegador de quem já está logado.
 */
const SESSION_COOKIE_NAME = "matriz2_admin_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export const ADMIN_SESSION_COOKIE_NAME = SESSION_COOKIE_NAME;
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_DURATION_MS / 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cria a sessão no banco e devolve o token cru, para gravar no cookie. */
export async function criarSessao(usuarioId: number, ip?: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.sessao.create({
    data: {
      usuarioId,
      tokenHash: hashToken(token),
      expiraEm: new Date(Date.now() + SESSION_DURATION_MS),
      ip,
      userAgent,
    },
  });
  return token;
}

export interface UsuarioLogado {
  id: number;
  email: string;
  nome: string;
  superAdmin: boolean;
  precisaTrocarSenha: boolean;
}

/**
 * Server Components/Layouts: o usuário da sessão válida, ou `null`. Sessões
 * expiradas não são apagadas aqui (só filtradas) — quem limpa é o próprio login,
 * que remove as expiradas do mesmo usuário antes de criar uma nova.
 */
export async function getAdminSession(): Promise<UsuarioLogado | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      usuario: {
        select: { id: true, email: true, nome: true, superAdmin: true, ativo: true, precisaTrocarSenha: true },
      },
    },
  });
  if (!sessao || sessao.expiraEm <= new Date() || !sessao.usuario.ativo) return null;

  return {
    id: sessao.usuario.id,
    email: sessao.usuario.email,
    nome: sessao.usuario.nome,
    superAdmin: sessao.usuario.superAdmin,
    precisaTrocarSenha: sessao.usuario.precisaTrocarSenha,
  };
}

/** Apaga a sessão do banco (não só o cookie) — é o que torna o token inútil de imediato. */
export async function apagarSessaoAtual(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}

/** Route Handlers: retorna uma resposta 401 se não autenticado, ou `null` se ok. */
export async function requireAdminSessionOrResponse(): Promise<NextResponse | null> {
  const usuario = await getAdminSession();
  if (!usuario) {
    return NextResponse.json({ errorMessage: "Não autenticado." }, { status: 401 });
  }
  return null;
}

/**
 * Layouts de páginas admin: redireciona para o login se não houver sessão válida.
 * Com sessão válida mas senha gerada (criação de conta ou reset por um super-admin),
 * força a ida para `/admin/conta` antes de deixar entrar em qualquer outra tela — a
 * própria página de troca de senha é a única exceção, para não virar um loop.
 */
export async function requireAdminOrRedirect(nextPath: string): Promise<UsuarioLogado> {
  const usuario = await getAdminSession();
  if (!usuario) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (usuario.precisaTrocarSenha && nextPath !== "/admin/conta") {
    redirect("/admin/conta?trocaObrigatoria=1");
  }
  return usuario;
}

/** Páginas só de super-admin (gestão de usuários, auditoria). */
export async function requireSuperAdminOrRedirect(nextPath: string): Promise<UsuarioLogado> {
  const usuario = await requireAdminOrRedirect(nextPath);
  if (!usuario.superAdmin) {
    redirect("/admin/orcamento");
  }
  return usuario;
}
