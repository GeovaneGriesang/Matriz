import { prisma } from "@/server/db/prisma";
import { requireSuperAdminOrRedirect } from "@/server/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { UsuariosPainel } from "@/components/admin/UsuariosPainel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const usuario = await requireSuperAdminOrRedirect("/admin/usuarios");

  const usuarios = await prisma.usuario.findMany({
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true, ultimoLoginEm: true },
  });

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <AdminHeader usuario={usuario} atual="/admin/usuarios" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Usuários</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">
          Só super-administradores acessam esta tela. Ao criar, a pessoa recebe um código por e-mail para o
          primeiro acesso. "Resetar senha" é a reserva sem depender de e-mail: gera uma senha temporária e
          derruba as sessões abertas daquela conta.
        </p>
      </div>

      <UsuariosPainel usuarios={usuarios} meuId={usuario.id} />
    </main>
  );
}
