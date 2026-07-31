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
          ciclo orçamentário e não são deriveáveis dos arquivos da PNP. Cadastre-os aqui por ano-base, à mão ou
          importando o CSV oficial. <strong>Estes valores já são usados no cálculo</strong>: quando existe um
          registro para o câmpus/instituição e ano-base do orçamento, ele substitui a aproximação calculada a
          partir dos dados brutos da PNP (ver a memória de cálculo em Consulta/Simulador para qual fonte foi usada
          em cada caso).
        </p>
      </div>
      <DadosAnuaisPanel />
    </main>
  );
}
