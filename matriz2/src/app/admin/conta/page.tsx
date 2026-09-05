import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TrocarSenhaForm } from "@/components/admin/TrocarSenhaForm";
import { FORM_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

export default async function AdminContaPage({
  searchParams,
}: {
  searchParams: Promise<{ trocaObrigatoria?: string }>;
}) {
  const usuario = await requireAdminOrRedirect("/admin/conta");
  const params = await searchParams;
  const trocaObrigatoria = params.trocaObrigatoria === "1" || usuario.precisaTrocarSenha;

  return (
    <main className={`mx-auto flex ${FORM_MAX_WIDTH} flex-col gap-6 px-6 py-12`}>
      <AdminHeader usuario={usuario} atual="/admin/conta" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Minha conta</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {usuario.nome} · {usuario.email}
        </p>
      </div>

      {trocaObrigatoria && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Esta senha foi gerada pelo sistema. Antes de continuar, escolha uma senha sua.
        </p>
      )}

      <TrocarSenhaForm trocaObrigatoria={trocaObrigatoria} />
    </main>
  );
}
