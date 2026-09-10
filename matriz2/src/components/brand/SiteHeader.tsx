import Link from "next/link";
import { InstitutoFederalMark } from "./InstitutoFederalMark";
import { ThemeToggle } from "./ThemeToggle";
import { SiteNav } from "./SiteNav";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { getAdminSession } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/adminAuth";

const LINK_CLASS = "text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100";

/**
 * As telas de Consulta/Comparativo/Evasão/Simulador/Dados importados exigem login
 * desde 2026-09-05 (vêm de exportações da MDO, não podem ficar públicas — ver
 * comentário no topo de `schema.prisma`). Por isso esta navegação só aparece para
 * quem tem acesso pleno (admin ou super-admin); anônimo e usuário `PADRAO` veem só
 * a marca e um convite para entrar, sem anunciar telas que não vão conseguir abrir.
 */
export async function SiteHeader() {
  const usuario = await getAdminSession();
  const acessoPleno = usuario && usuario.papel !== "PADRAO";

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white px-4 py-4 sm:px-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-wrap items-center gap-3`}>
        <Link href="/" className="flex items-center gap-3">
          <InstitutoFederalMark size={32} />
          <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Matriz Orçamentária RFEPCT
          </span>
        </Link>
        {acessoPleno && <SiteNav />}
        {usuario && !acessoPleno && (
          <nav>
            <Link href="/admin/inicio" className={LINK_CLASS}>
              Painel
            </Link>
          </nav>
        )}
        {!usuario && (
          <nav>
            <Link href="/admin/login" className={LINK_CLASS}>
              Entrar
            </Link>
          </nav>
        )}
        {usuario && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-neutral-500 dark:text-neutral-400" title={usuario.email}>
              {usuario.nome}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Sair
              </button>
            </form>
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
