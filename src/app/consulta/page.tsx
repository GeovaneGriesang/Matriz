import { ConsultaPanel } from "@/components/consulta/ConsultaPanel";

export default function ConsultaPage() {
  return (
    <main className="flex flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Consulta da distribuição oficial
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Veja quanto foi distribuído em cada ano e quanto cada instituição e câmpus recebeu, com base no orçamento
          oficial definido pelo administrador.
        </p>
      </div>
      <ConsultaPanel />
    </main>
  );
}
