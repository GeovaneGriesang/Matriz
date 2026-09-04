import { prisma } from "@/server/db/prisma";
import { requireSuperAdminOrRedirect } from "@/server/auth/session";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export const dynamic = "force-dynamic";

const LIMITE = 200;
const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ usuarioId?: string; acao?: string }>;
}) {
  const usuario = await requireSuperAdminOrRedirect("/admin/auditoria");
  const params = await searchParams;

  const usuarioIdFiltro = params.usuarioId ? Number(params.usuarioId) : undefined;
  const acaoFiltro = params.acao?.trim() || undefined;

  const [registros, usuarios, acoes] = await Promise.all([
    prisma.registroAuditoria.findMany({
      where: {
        usuarioId: usuarioIdFiltro,
        acao: acaoFiltro,
      },
      orderBy: { criadoEm: "desc" },
      take: LIMITE,
      include: { usuario: { select: { nome: true, email: true } } },
    }),
    prisma.usuario.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.registroAuditoria.findMany({
      distinct: ["acao"],
      select: { acao: true },
      orderBy: { acao: "asc" },
    }),
  ]);

  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-12 lg:px-12`}>
      <AdminHeader usuario={usuario} atual="/admin/auditoria" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Auditoria</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">
          Quem fez o quê, e quando: todo login, logout, troca ou reset de senha, criação de usuário e correção
          manual de dados fica registrado aqui. Mostra os {LIMITE} registros mais recentes.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-col gap-1">
          <label htmlFor="usuarioId" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Usuário
          </label>
          <select
            id="usuarioId"
            name="usuarioId"
            defaultValue={params.usuarioId ?? ""}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="acao" className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            Ação
          </label>
          <select
            id="acao"
            name="acao"
            defaultValue={params.acao ?? ""}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="">Todas</option>
            {acoes.map((a) => (
              <option key={a.acao} value={a.acao}>
                {a.acao}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Quem</th>
              <th className="px-4 py-2">Ação</th>
              <th className="px-4 py-2">Detalhe</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                  {formatoData.format(r.criadoEm)}
                </td>
                <td className="px-4 py-2 text-neutral-900 dark:text-neutral-100">
                  {r.usuario ? r.usuario.nome : "(sistema)"}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">{r.acao}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {r.detalhe ? JSON.stringify(r.detalhe) : ""}
                </td>
                <td className="px-4 py-2 text-neutral-500 dark:text-neutral-400">{r.ip ?? ""}</td>
              </tr>
            ))}
            {registros.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
                  Nenhum registro para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
