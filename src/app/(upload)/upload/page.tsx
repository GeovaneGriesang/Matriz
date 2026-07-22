import { CsvUploadForm } from "@/components/upload/CsvUploadForm";

export default function UploadPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Upload de extrato PNP</h1>
        <p className="text-neutral-600">
          Envie um arquivo CSV da Plataforma Nilo Peçanha para iniciar o processamento do arquivo.
        </p>
      </div>
      <CsvUploadForm />
    </main>
  );
}
