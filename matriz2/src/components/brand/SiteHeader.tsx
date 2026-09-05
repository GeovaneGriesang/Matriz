import Link from "next/link";
import { InstitutoFederalMark } from "./InstitutoFederalMark";
import { ThemeToggle } from "./ThemeToggle";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";
import { getAdminSession } from "@/server/auth/session";

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
    <header className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-wrap items-center gap-3`}>
        <Link href="/" className="flex items-center gap-3">
          <InstitutoFederalMark size={32} />
          <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Matriz Orçamentária RFEPCT
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          {acessoPleno && (
            <>
              <Link href="/consulta" className={LINK_CLASS}>
                Consulta
              </Link>
              <Link href="/comparativo" className={LINK_CLASS}>
                Comparativo
              </Link>
              <Link href="/evasao" className={LINK_CLASS}>
                Perda por evasão
              </Link>
              <Link href="/simulador" className={LINK_CLASS}>
                Simulador
              </Link>
              <Link href="/dados-importados" className={LINK_CLASS}>
                Dados importados
              </Link>
              <Link href="/admin/orcamento" className={LINK_CLASS}>
                Painel
              </Link>
            </>
          )}
          {usuario && !acessoPleno && (
            <Link href="/admin/inicio" className={LINK_CLASS}>
              Painel
            </Link>
          )}
          {!usuario && (
            <Link href="/admin/login" className={LINK_CLASS}>
              Entrar
            </Link>
          )}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
