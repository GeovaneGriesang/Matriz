import { ConsultaPanel } from "@/components/consulta/ConsultaPanel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export default function ConsultaPage() {
  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-16 lg:px-12`}>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Consulta da distribuição oficial
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Veja quanto foi distribuído em cada ano e quanto cada instituição e câmpus recebeu, com base no orçamento
          oficial definido pelo administrador.
        </p>
      </div>
      <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <p className="font-semibold">Bloco Funcionamento pode estar acima do valor real neste sistema.</p>
        <p className="mt-1">
          O Piso Mínimo por Câmpus Novo é somado por cima do valor calculado por matrícula; a metodologia
          oficial da CONIF reserva esse piso de dentro dos 80% do Bloco Funcionamento antes de ratear entre
          os câmpus, e não por cima. No ciclo 2027 isso infla o bloco em cerca de R$ 40,4 milhões (67
          câmpus recebem o piso aqui, contra os 53 da planilha oficial).
        </p>
        <p className="mt-1">
          Os números corretos, importados direto do que a CONIF já homologou (sem recalcular), estão no{" "}
          <a
            href="https://movaci.com.br/matriz2/consulta"
            className="font-medium underline hover:text-red-700 dark:hover:text-red-100"
          >
            Matriz2
          </a>
          , o sistema que está substituindo este.
        </p>
      </div>
      <ConsultaPanel />
    </main>
  );
}
