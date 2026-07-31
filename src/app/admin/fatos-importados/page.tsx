import { FatosImportadosPanel } from "@/components/admin/FatosImportadosPanel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export default function FatosImportadosPage() {
  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-16 lg:px-12`}>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Dados importados</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Consulta direta dos 18 tipos de arquivo da PNP já importados (tabela <code>FatoIndicador</code>), filtrando
          por tipo de arquivo, ano, instituição, câmpus e medida. Cada linha é uma medida individual (ex.: &quot;Número
          de Matrículas&quot;) — o mesmo câmpus/ano aparece em várias linhas, uma por medida.
        </p>
      </div>
      <FatosImportadosPanel />
    </main>
  );
}
