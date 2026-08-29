import type { ReactNode } from "react";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function UploadLayout({ children }: { children: ReactNode }) {
  await requireAdminOrRedirect("/upload");

  return (
    <div>
      <AdminNav atual="/upload" />
      {children}
    </div>
  );
}
