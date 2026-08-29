import type { ReactNode } from "react";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function UnidadesLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect("/admin/unidades");

  return (
    <div>
      <AdminNav atual="/admin/unidades" />
      {children}
    </div>
  );
}
