import { UnidadesAnoCriacaoPanel } from "@/components/admin/UnidadesAnoCriacaoPanel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export default function UnidadesPage() {
  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-16 lg:px-12`}>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Câmpus</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Ano de criação de cada câmpus — essa informação não existe em nenhum arquivo da PNP; foi pré-carregada a
          partir da planilha oficial (aba &quot;Completo Proposta&quot;) e pode ser revisada ou completada aqui,
          inclusive para câmpus novos ainda sem dados PNP ingeridos. Usada só pelo Piso Mínimo do Bloco Funcionamento
          (
          <a
            href="/admin/orcamento"
            className="underline hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            configurado em Orçamento anual
          </a>
          ) para câmpus criados a partir de 2018. Reitorias e Direções Gerais não aparecem aqui — são unidades
          administrativas, sem Bloco Funcionamento.
        </p>
      </div>
      <UnidadesAnoCriacaoPanel />
    </main>
  );
}
