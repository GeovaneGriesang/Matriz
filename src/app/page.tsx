import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Matriz Orçamentária RFEPCT</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Plataforma de cálculo, auditoria e simulação da Matriz Orçamentária da Rede Federal.
      </p>
      <Link
        href="/upload"
        className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        Enviar extrato da PNP
      </Link>
    </main>
  );
}
