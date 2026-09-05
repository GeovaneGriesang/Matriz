import { Suspense } from "react";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Entrar</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Acesso restrito a quem tem conta cadastrada.
        </p>
      </div>
      <Suspense>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}
