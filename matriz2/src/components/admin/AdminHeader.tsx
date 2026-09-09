import Link from "next/link";
import type { Papel } from "@prisma/client";
import type { UsuarioLogado } from "@/server/auth/session";

const RANQUE: Record<Papel, number> = { PADRAO: 0, ADMIN: 1, SUPER_ADMIN: 2 };

/**
 * Cabeçalho comum às telas administrativas: navegação entre as telas (algumas
 * exigem admin ou super-admin, outras só super-admin) e o link para "Minha
 * conta". Existe para não repetir essa barra em cada página.
 */
export function AdminHeader({ usuario, atual }: { usuario: UsuarioLogado; atual: string }) {
  const links: { href: string; rotulo: string; minimo: Papel }[] = [
    { href: "/admin/orcamento", rotulo: "Correção manual", minimo: "ADMIN" },
    { href: "/admin/valores-recebidos", rotulo: "Valores recebidos", minimo: "ADMIN" },
    { href: "/admin/usuarios", rotulo: "Usuários", minimo: "SUPER_ADMIN" },
    { href: "/admin/auditoria", rotulo: "Auditoria", minimo: "SUPER_ADMIN" },
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1">
          {links
            .filter((l) => RANQUE[usuario.papel] >= RANQUE[l.minimo])
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
        {/* Nome e "Sair" já aparecem no cabeçalho principal (`SiteHeader`, em toda
            página, não só nas administrativas): repetir aqui era duplicado. Só
            "Minha conta" fica, por ser um link que não existe lá em cima. */}
        <Link href="/admin/conta" className="text-sm text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          Minha conta
        </Link>
      </div>
    </div>
  );
}
