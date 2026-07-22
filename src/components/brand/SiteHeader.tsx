import Link from "next/link";
import { InstitutoFederalMark } from "./InstitutoFederalMark";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <InstitutoFederalMark size={32} />
        <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-900">
          Matriz Orçamentária RFEPCT
        </Link>
      </div>
    </header>
  );
}
