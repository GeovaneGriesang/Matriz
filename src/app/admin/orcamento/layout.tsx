import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/adminAuth";

export default async function OrcamentoLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect("/admin/orcamento");

  return (
    <div>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 pt-4">
        <Link
          href="/upload"
          className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Upload de extrato PNP
        </Link>
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
