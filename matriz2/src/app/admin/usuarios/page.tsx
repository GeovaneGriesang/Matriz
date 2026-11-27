import { prisma } from "@/server/db/prisma";
import { requireGestorDeUsuariosOrRedirect } from "@/server/auth/session";
import { perfisQueMeuPapelCria } from "@/lib/permissoes";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { UsuariosPainel } from "@/components/admin/UsuariosPainel";
import { PedidosAcessoPainel } from "@/components/admin/PedidosAcessoPainel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { nomeCurtoDaUnidade } from "@/lib/campusDoUsuario";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const usuario = await requireGestorDeUsuariosOrRedirect("/admin/usuarios");
  const ehSuper = usuario.papel === "SUPER_ADMIN";

  const [usuarios, unidades, pedidos, decididos] = await Promise.all([
    prisma.usuario.findMany({
      // O administrador não vê as contas de super-admin.
      where: ehSuper ? undefined : { papel: { not: "SUPER_ADMIN" } },
      orderBy: { criadoEm: "asc" },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true, ultimoLoginEm: true, unidadeId: true },
    }),
    prisma.unidade.findMany({ where: { instituicao: { sigla: "IFSUL" } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.pedidoAcesso.findMany({
      where: { situacao: "PENDENTE" },
      orderBy: { criadoEm: "asc" },
      select: { id: true, nome: true, email: true, unidadeId: true, motivo: true, criadoEm: true },
    }),
    prisma.pedidoAcesso.findMany({
      where: { situacao: { not: "PENDENTE" } },
      orderBy: { decididoEm: "desc" },
      take: 20,
      select: { id: true, nome: true, email: true, situacao: true, decididoEm: true, decididoPor: { select: { nome: true } } },
    }),
  ]);
  const campi = unidades.map((u) => ({ id: u.id, nome: nomeCurtoDaUnidade(u.nome) }));

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <AdminHeader usuario={usuario} atual="/admin/usuarios" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Usuários</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {ehSuper
            ? "Você é super-admin: cadastra administradores e usuários padrão, muda o perfil dos outros usuários (na coluna Perfil) e age sobre qualquer conta. Só você altera a Correção manual e os Valores recebidos; os administradores apenas consultam."
            : "Você é administrador: cadastra usuários de perfil padrão e pode resetar a senha ou desativar essas contas. Só o super-admin cadastra administradores."}{" "}
          Ao criar, a pessoa recebe um código por e-mail para o primeiro acesso. "Resetar senha" é a reserva sem
          depender de e-mail: gera uma senha temporária e derruba as sessões abertas daquela conta.
        </p>
        <p className="text-neutral-600 dark:text-neutral-400">
          <strong>Câmpus:</strong> o câmpus a que a pessoa pertence. Ele abre as telas próprias do câmpus: quem é de Venâncio Aires vê o Orçamento do município de
          Venâncio Aires. Deixe "nenhum" para quem é da Reitoria ou de fora do IFSul. O super-admin vê todas as telas, com qualquer câmpus.
        </p>
      </div>

      <PedidosAcessoPainel
        pedidos={pedidos}
        decididos={decididos.map((d) => ({ id: d.id, nome: d.nome, email: d.email, situacao: d.situacao as "APROVADO" | "RECUSADO", decididoEm: d.decididoEm, decididoPor: d.decididoPor?.nome ?? null }))}
        campi={campi}
        perfisQueCrio={perfisQueMeuPapelCria(usuario.papel)}
      />

      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Contas</h2>
      <UsuariosPainel usuarios={usuarios} campi={campi} meuId={usuario.id} meuPapel={usuario.papel} perfisQueCrio={perfisQueMeuPapelCria(usuario.papel)} />
    </main>
  );
}
