import Link from "next/link";
import { InstitutoFederalMark } from "./InstitutoFederalMark";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <InstitutoFederalMark size={32} />
        <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Matriz Orçamentária RFEPCT
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/simulador"
            className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Simulador
          </Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
