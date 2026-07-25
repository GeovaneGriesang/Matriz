import { UnidadesAnoCriacaoPanel } from "@/components/admin/UnidadesAnoCriacaoPanel";

export default function UnidadesPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Câmpus</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Cadastre o ano de criação de cada câmpus — essa informação não existe em nenhum arquivo da PNP, então é
          mantida manualmente aqui. Usada só pelo Piso Mínimo do Bloco Funcionamento (
          <a
            href="/admin/orcamento"
            className="underline hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            configurado em Orçamento anual
          </a>
          ) para câmpus criados a partir de 2018.
        </p>
      </div>
      <UnidadesAnoCriacaoPanel />
    </main>
  );
}
