import type { ReactNode } from "react";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function DadosAnuaisLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect("/admin/dados-anuais");

  return (
    <div>
      <AdminNav atual="/admin/dados-anuais" />
      {children}
    </div>
  );
}
