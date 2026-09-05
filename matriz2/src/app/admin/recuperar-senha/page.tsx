import { RecuperarSenhaForm } from "@/components/auth/RecuperarSenhaForm";

export default function RecuperarSenhaPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Recuperar acesso</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Informe o e-mail cadastrado. Se existir uma conta, enviamos um código para você definir uma senha
          nova.
        </p>
      </div>
      <RecuperarSenhaForm />
    </main>
  );
}
