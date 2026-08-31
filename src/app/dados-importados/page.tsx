import { DadosImportadosTabs } from "@/components/dadosImportados/DadosImportadosTabs";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export default function DadosImportadosPage() {
  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-16 lg:px-12`}>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Dados importados</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Consulta de todos os dados usados pelo sistema, com a origem de cada um: os 18 tipos de arquivo da PNP já
          importados (aba PNP) e os valores oficiais publicados pela CONIF por ano-base — Matrícula Total equalizada,
          RAPP, Eficiência Acadêmica e Custeio/Assistência (aba Dados anuais).
        </p>
      </div>
      <DadosImportadosTabs />
    </main>
  );
}
