import { requireAdminOrRedirect } from "@/server/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { FORM_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

/**
 * Página de chegada do usuário `PADRAO`: por enquanto não há nenhum dado baseado em
 * PNP carregado (só a MDO alimenta o sistema hoje), então não há tela de conteúdo
 * para mostrar a esse papel — ver o comentário no topo de `schema.prisma`.
 */
export default async function AdminInicioPage() {
  const usuario = await requireAdminOrRedirect("/admin/inicio");

  return (
    <main className={`mx-auto flex ${FORM_MAX_WIDTH} flex-col gap-6 px-6 py-12`}>
      <AdminHeader usuario={usuario} atual="/admin/inicio" />

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Olá, {usuario.nome}</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Seu perfil (padrão) vê apenas dados baseados na Plataforma Nilo Peçanha (PNP), sem passar pela
          Matriz de Distribuição Orçamentária. Ainda não há nenhum desses dados carregados no sistema, então
          não há nada para mostrar aqui por enquanto.
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Se você acha que deveria ter mais acesso, fale com um administrador.
        </p>
      </div>
    </main>
  );
}
