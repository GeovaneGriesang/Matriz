import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/adminAuth";

export default async function UploadLayout({ children }: { children: ReactNode }) {
  const autenticado = await getAdminSession();
  if (!autenticado) {
    redirect("/admin/login?next=/upload");
  }

  return (
    <div>
      <form action={logoutAction} className="mx-auto flex max-w-2xl justify-end px-6 pt-4">
        <button
          type="submit"
          className="text-xs font-medium text-neutral-500 underline hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Sair
        </button>
      </form>
      {children}
    </div>
  );
}
