import { DadosAnuaisPanel } from "@/components/admin/DadosAnuaisPanel";

export default function DadosAnuaisPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Dados anuais</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Matrícula Total equalizada (por câmpus), RAP Presencial oficial — RAPP (por instituição) e Eficiência
          Acadêmica oficial — Conclusão/Evasão/Retenção de Ciclo (por instituição) são publicados pela CONIF a cada
          ciclo orçamentário e não são deriveáveis dos arquivos da PNP. Cadastre-os aqui por ano-base, à mão ou
          importando o CSV oficial. <strong>Estes valores ainda não são usados no cálculo</strong> — essa ligação é
          um passo futuro, pendente de confirmação da fórmula de uso com CONIF/SETEC.
        </p>
      </div>
      <DadosAnuaisPanel />
    </main>
  );
}
