import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TrocarSenhaForm } from "@/components/admin/TrocarSenhaForm";
import { FORM_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

export default async function AdminContaPage() {
  const usuario = await requireAdminOrRedirect("/admin/conta");

  return (
    <main className={`mx-auto flex ${FORM_MAX_WIDTH} flex-col gap-6 px-6 py-12`}>
      <AdminHeader usuario={usuario} atual="/admin/conta" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Minha conta</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {usuario.nome} · {usuario.email}
          {usuario.superAdmin && <span className="text-if-green"> · super-admin</span>}
        </p>
      </div>

      <TrocarSenhaForm />
    </main>
  );
}
