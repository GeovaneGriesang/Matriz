"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PNP_FILE_TYPES, type PnpFileType } from "@/ingestion/config/fileTypes";
import { getFileTypeMetadata } from "@/ingestion/config/fileMetadata";

interface UploadResponse {
  ok: boolean;
  ingestionBatchId?: number;
  status?: string;
  rowCount?: number;
  issueCount?: number;
  errorMessage?: string;
}

function baixarModelo(fileType: PnpFileType) {
  const metadata = getFileTypeMetadata(fileType);
  const cabecalho = metadata.columns.map((coluna) => coluna.header).join(",");
  const blob = new Blob([cabecalho + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = metadata.suggestedFileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function CsvUploadForm() {
  const [fileType, setFileType] = useState<PnpFileType>(PNP_FILE_TYPES[0] ?? "DADOS_GERAIS");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<UploadResponse | null>(null);

  const metadata = useMemo(() => getFileTypeMetadata(fileType), [fileType]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setEnviando(true);
    setResultado(null);
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = (await response.json()) as UploadResponse;
      setResultado(data);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-medium">Não se preocupe com a codificação: o sistema identifica o formato de forma automática.</p>
        <p>
          Pode enviar o arquivo em <strong>UTF-8</strong> ou <strong>ISO-8859-1 (Latin-1)</strong> sem
          precisar converter nada. Se houver qualquer problema com os acentos, o relatório de validação vai
          te avisar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="fileType" className="text-sm font-medium">
            Tipo de arquivo PNP
          </label>
          <select
            id="fileType"
            name="fileType"
            value={fileType}
            onChange={(e) => setFileType(e.target.value as PnpFileType)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {PNP_FILE_TYPES.map((tipo) => (
              <option key={tipo} value={tipo}>
                {getFileTypeMetadata(tipo).label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p>
            Nome de arquivo sugerido: <code className="rounded bg-neutral-200 px-1">{metadata.suggestedFileName}</code>
          </p>
          <p className="text-neutral-700">{metadata.description}</p>

          {!metadata.inScopeM1 && (
            <p className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">
              Este arquivo ainda não entra em nenhum cálculo desta versão do sistema.
            </p>
          )}

          <div>
            <p className="mb-1 font-medium">Colunas esperadas:</p>
            <ul className="list-inside list-disc">
              {metadata.columns.map((coluna) => (
                <li key={coluna.header}>
                  {coluna.header}
                  {coluna.required && <span className="text-red-600"> *</span>}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-neutral-500">
              * obrigatória. Pequenas variações no nome da coluna (maiúsculas, acentos, abreviações) são
              toleradas — o sistema não exige o nome exato.
            </p>
          </div>

          <button
            type="button"
            onClick={() => baixarModelo(fileType)}
            className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
          >
            Baixar modelo CSV vazio
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="file" className="text-sm font-medium">
            Arquivo CSV
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv"
            required
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Enviar"}
        </button>

        {resultado && (
          <div
            className={`rounded-md p-4 text-sm ${
              resultado.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
            }`}
          >
            {resultado.ok ? (
              <>
                <p>
                  Batch #{resultado.ingestionBatchId} — status: <strong>{resultado.status}</strong>
                </p>
                <p>
                  {resultado.rowCount} linha(s) processada(s), {resultado.issueCount} alerta(s) de validação.
                </p>
              </>
            ) : (
              <p>Erro: {resultado.errorMessage ?? "falha na validação do arquivo."}</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
