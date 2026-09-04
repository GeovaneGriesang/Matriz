import Link from "next/link";
import { logoutAction } from "@/server/actions/adminAuth";
import type { UsuarioLogado } from "@/server/auth/session";

/**
 * Cabeçalho comum às telas administrativas: quem está logado, navegação entre as
 * telas (algumas só aparecem para super-admin) e o botão de sair. Existe para não
 * repetir essa barra em cada página — eram três cópias quase idênticas antes desta
 * versão.
 */
export function AdminHeader({ usuario, atual }: { usuario: UsuarioLogado; atual: string }) {
  const links = [
    { href: "/admin/orcamento", rotulo: "Correção manual", soSuperAdmin: false },
    { href: "/admin/usuarios", rotulo: "Usuários", soSuperAdmin: true },
    { href: "/admin/auditoria", rotulo: "Auditoria", soSuperAdmin: true },
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1">
          {links
            .filter((l) => !l.soSuperAdmin || usuario.superAdmin)
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={atual === l.href ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  atual === l.href
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {l.rotulo}
              </Link>
            ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">
            {usuario.nome} {usuario.superAdmin && <span className="text-if-green">· super-admin</span>}
          </span>
          <Link href="/admin/conta" className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
            Minha conta
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="font-medium text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-100">
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
