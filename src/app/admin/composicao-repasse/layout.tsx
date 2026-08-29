import type { ReactNode } from "react";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function ComposicaoRepasseLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect("/admin/composicao-repasse");

  return (
    <div>
      <AdminNav atual="/admin/composicao-repasse" />
      {children}
    </div>
  );
}
