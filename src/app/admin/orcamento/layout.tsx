import type { ReactNode } from "react";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function OrcamentoLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect("/admin/orcamento");

  return (
    <div>
      <AdminNav atual="/admin/orcamento" />
      {children}
    </div>
  );
}
