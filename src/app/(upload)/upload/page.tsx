import { CsvUploadForm } from "@/components/upload/CsvUploadForm";

export default function UploadPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Extratos da PNP</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Envie um arquivo CSV da Plataforma Nilo Peçanha. São os dados brutos de matrícula, evasão, docentes e
          percentuais legais — a base de tudo: é da ingestão deles que o sistema aprende quais instituições e
          câmpus existem.
        </p>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          <strong>Este é o passo 1 de 5.</strong> A PNP não traz tudo o que a matriz precisa: o ano de criação dos
          câmpus, os valores publicados pela CONIF a cada ciclo e os pesos de repasse vêm dos passos seguintes,
          na barra acima.
        </p>
      </div>
      <CsvUploadForm />
    </main>
  );
}
