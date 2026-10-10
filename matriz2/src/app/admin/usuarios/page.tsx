import { prisma } from "@/server/db/prisma";
import { requireGestorDeUsuariosOrRedirect } from "@/server/auth/session";
import { perfisQueMeuPapelCria } from "@/lib/permissoes";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { UsuariosPainel } from "@/components/admin/UsuariosPainel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const usuario = await requireGestorDeUsuariosOrRedirect("/admin/usuarios");
  const ehSuper = usuario.papel === "SUPER_ADMIN";

  const usuarios = await prisma.usuario.findMany({
    // O administrador não vê as contas de super-admin.
    where: ehSuper ? undefined : { papel: { not: "SUPER_ADMIN" } },
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true, ultimoLoginEm: true },
  });

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <AdminHeader usuario={usuario} atual="/admin/usuarios" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Usuários</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {ehSuper
            ? "Você é super-admin: cadastra administradores e usuários padrão e age sobre qualquer conta."
            : "Você é administrador: cadastra usuários de perfil padrão e pode resetar a senha ou desativar essas contas. Só o super-admin cadastra administradores."}{" "}
          Ao criar, a pessoa recebe um código por e-mail para o primeiro acesso. "Resetar senha" é a reserva sem
          depender de e-mail: gera uma senha temporária e derruba as sessões abertas daquela conta.
        </p>
      </div>

      <UsuariosPainel usuarios={usuarios} meuId={usuario.id} meuPapel={usuario.papel} perfisQueCrio={perfisQueMeuPapelCria(usuario.papel)} />
    </main>
  );
}
