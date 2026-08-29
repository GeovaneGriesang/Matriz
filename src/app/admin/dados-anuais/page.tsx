import { DadosAnuaisPanel } from "@/components/admin/DadosAnuaisPanel";
import { TABLE_MAX_WIDTH } from "@/lib/layoutWidths";

export default function DadosAnuaisPage() {
  return (
    <main className={`mx-auto flex ${TABLE_MAX_WIDTH} flex-col gap-6 px-6 py-16 lg:px-12`}>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Dados anuais</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Matrícula Total equalizada (por câmpus), RAP Presencial oficial — RAPP (por instituição) e Eficiência
          Acadêmica oficial — Conclusão/Evasão/Retenção de Ciclo (por instituição) são publicados pela CONIF a cada
          ciclo orçamentário e não são deriveáveis dos arquivos da PNP. Cadastre-os aqui por ano do orçamento, à mão ou
          importando o CSV oficial. <strong>Estes valores já são usados no cálculo</strong>: quando existe um
          registro para o câmpus/instituição e ano do orçamento, ele substitui a aproximação calculada a
          partir dos dados brutos da PNP (ver a memória de cálculo em Consulta/Simulador para qual fonte foi usada
          em cada caso).
        </p>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Atenção ao ano.</strong> Aqui se informa o <strong>ano do orçamento</strong> (2026, 2027…), não o
          ano da PNP de onde os números saíram. A planilha do ciclo 2027 usa dados da PNP de 2025, mas os valores
          dela devem ser cadastrados como <strong>2027</strong> — é assim que o cálculo os procura. Até 28/08/2026
          esta tela chamava o campo de &quot;ano-base&quot;, o que sugeria o contrário e levaria a cadastrar sob um
          ano em que o cálculo nunca encontraria os dados.
        </p>
      </div>
      <DadosAnuaisPanel />
    </main>
  );
}
