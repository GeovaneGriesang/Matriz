import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/adminAuth";

export default async function UnidadesLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect("/admin/unidades");

  return (
    <div>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/orcamento"
            className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Orçamento anual
          </Link>
          <Link
            href="/admin/dados-anuais"
            className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Dados anuais
          </Link>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Sair
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
