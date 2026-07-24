import { OrcamentoAnualPanel } from "@/components/admin/OrcamentoAnualPanel";

export default function OrcamentoAnualPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Orçamento anual</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Defina o orçamento total oficial de cada ano — esse valor é usado para calcular a distribuição de todas as
          instituições com dados da PNP disponíveis, cada uma distribuída só entre seus próprios câmpus.
        </p>
      </div>
      <OrcamentoAnualPanel />
    </main>
  );
}
