import { Suspense } from "react";
import { DefinirSenhaForm } from "@/components/auth/DefinirSenhaForm";

export default function DefinirSenhaPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Definir senha</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Use o código que chegou por e-mail (primeiro acesso ou recuperação) para escolher sua senha.
        </p>
      </div>
      <Suspense>
        <DefinirSenhaForm />
      </Suspense>
    </main>
  );
}
