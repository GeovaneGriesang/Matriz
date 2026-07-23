import { SimuladorPanel } from "@/components/simulador/SimuladorPanel";

export default function SimuladorPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Simulador da Matriz Orçamentária
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Informe um orçamento total e um ano de referência para calcular a distribuição entre
          instituições e câmpus, ou consulte uma execução já feita anteriormente.
        </p>
      </div>
      <SimuladorPanel />
    </main>
  );
}
