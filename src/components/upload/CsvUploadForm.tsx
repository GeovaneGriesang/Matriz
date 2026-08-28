"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PNP_FILE_TYPES, type PnpFileType } from "@/ingestion/config/fileTypes";
import { ALL_FILE_TYPE_METADATA, getFileTypeMetadata } from "@/ingestion/config/fileMetadata";
import { apiUrl } from "@/lib/basePath";

interface UploadResponse {
  ok: boolean;
  cancelled?: boolean;
  ingestionBatchId?: number;
  status?: string;
  rowCount?: number;
  issueCount?: number;
  errorMessage?: string;
  issues?: { severity: string; message: string; field?: string; rowIndex?: number }[];
  tabelasAfetadas?: {
    deletedFactCount: number;
    insertedFactCount: number;
    instituicaoCount: number;
    unidadeCount: number;
    anosInalterados: number;
    anosGravados: number;
  };
  anos?: ResumoAnoCliente[];
}

type ResultadoAno = "INSERIDO" | "ATUALIZADO" | "INALTERADO" | "REMOVIDO";

interface ResumoAnoCliente {
  ano: number;
  resultado: ResultadoAno;
  rowCount: number;
  deletedFactCount: number;
  insertedFactCount: number;
}

/** Rótulo, explicação e cor de cada situação possível de um ano — fonte única para a legenda e a tabela. */
const SITUACAO_ANO: Record<ResultadoAno, { rotulo: string; explicacao: string; classe: string }> = {
  INALTERADO: {
    rotulo: "Inalterado",
    explicacao: "o conteúdo deste ano é idêntico ao da última importação, então nada foi tocado no banco",
    classe: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  },
  INSERIDO: {
    rotulo: "Inserido",
    explicacao: "ano que ainda não existia no banco — foi gravado agora pela primeira vez",
    classe: "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100",
  },
  ATUALIZADO: {
    rotulo: "Atualizado",
    explicacao: "o conteúdo deste ano mudou em relação à última importação — os dados antigos foram substituídos",
    classe: "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
  },
  REMOVIDO: {
    rotulo: "Removido",
    explicacao: "o ano existia no banco mas não veio neste arquivo — foi apagado para o arquivo seguir sendo a fonte da verdade",
    classe: "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  },
};

interface ProgressoServidor {
  total: number;
  processed: number;
  status: "parsing" | "deleting" | "persisting" | "done" | "error" | "cancelled";
  anoAtual?: number;
}

interface UltimoUploadPorTipo {
  fileType: PnpFileType;
  originalFilename: string;
  rowCount: number | null;
  completedAt: string | null;
  createdAt: string;
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * `fetch` não expõe progresso de envio; `XMLHttpRequest` sim, via
 * `upload.onprogress`. Usado só para ter uma barra de progresso real do
 * upload — o processamento no servidor é reportado à parte, via polling em
 * `/api/uploads/progress`.
 */
function enviarComProgresso(formData: FormData, onProgress: (percentual: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/api/uploads"));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText) as UploadResponse);
      } catch {
        reject(new Error("Resposta inválida do servidor."));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar o arquivo."));
    xhr.send(formData);
  });
}

function formatarTempo(segundos: number): string {
  const min = Math.floor(segundos / 60)
    .toString()
    .padStart(2, "0");
  const seg = (segundos % 60).toString().padStart(2, "0");
  return `${min}:${seg}`;
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
  const [cancelando, setCancelando] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState(0);
  const [progressoServidor, setProgressoServidor] = useState<ProgressoServidor | null>(null);
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);
  const [resultado, setResultado] = useState<UploadResponse | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [ultimosUploads, setUltimosUploads] = useState<Map<PnpFileType, UltimoUploadPorTipo>>(new Map());

  const uploadIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const metadata = useMemo(() => getFileTypeMetadata(fileType), [fileType]);

  const gruposOrdenados = useMemo(() => {
    const porGrupo = new Map<string, typeof ALL_FILE_TYPE_METADATA>();
    for (const item of ALL_FILE_TYPE_METADATA) {
      const lista = porGrupo.get(item.grupo) ?? [];
      lista.push(item);
      porGrupo.set(item.grupo, lista);
    }
    return Array.from(porGrupo.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  function pararAcompanhamento() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Garante que os intervalos não sobrevivem se o componente desmontar em plena importação.
  useEffect(() => () => pararAcompanhamento(), []);

  function carregarUltimosUploads() {
    fetch(apiUrl("/api/ingestion-batches"))
      .then((response) => (response.ok ? (response.json() as Promise<UltimoUploadPorTipo[]>) : []))
      .then((lista) => setUltimosUploads(new Map(lista.map((item) => [item.fileType, item]))))
      .catch(() => {
        // Falha pontual ao listar não deve travar a tela de upload.
      });
  }

  useEffect(() => carregarUltimosUploads(), []);

  const ultimoUploadDoTipo = ultimosUploads.get(fileType) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const uploadId = crypto.randomUUID();
    uploadIdRef.current = uploadId;
    formData.set("uploadId", uploadId);

    setEnviando(true);
    setCancelando(false);
    setProgressoUpload(0);
    setProgressoServidor(null);
    setSegundosDecorridos(0);
    setResultado(null);

    timerRef.current = setInterval(() => setSegundosDecorridos((s) => s + 1), 1000);
    pollRef.current = setInterval(() => {
      fetch(apiUrl(`/api/uploads/progress?id=${uploadId}`))
        .then((response) => (response.ok ? (response.json() as Promise<ProgressoServidor>) : null))
        .then((dados) => {
          if (dados) setProgressoServidor(dados);
        })
        .catch(() => {
          // Falha pontual de polling não deve interromper a importação em andamento.
        });
    }, 500);

    try {
      const data = await enviarComProgresso(formData, setProgressoUpload);
      setResultado(data);
      if (data.ok) carregarUltimosUploads();
    } catch (error) {
      setResultado({ ok: false, errorMessage: (error as Error).message });
    } finally {
      pararAcompanhamento();
      setEnviando(false);
      setCancelando(false);
      setProgressoUpload(0);
      setProgressoServidor(null);
      uploadIdRef.current = null;
    }
  }

  async function handleCancelar() {
    if (!uploadIdRef.current) return;
    setCancelando(true);
    try {
      await fetch(apiUrl("/api/uploads/cancel"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: uploadIdRef.current }),
      });
    } catch {
      // Se a chamada de cancelamento falhar, a importação segue normalmente até concluir.
    }
  }

  const progressoServidorPercentual =
    progressoServidor && progressoServidor.total > 0
      ? Math.round((progressoServidor.processed / progressoServidor.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
        <p className="font-medium">Não se preocupe com a codificação: o sistema identifica o formato de forma automática.</p>
        <p>
          Pode enviar o arquivo em <strong>UTF-8</strong> ou <strong>ISO-8859-1 (Latin-1)</strong> sem
          precisar converter nada. Se houver qualquer problema com os acentos, o relatório de validação vai
          te avisar.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="fileType" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Tipo de arquivo PNP
          </label>
          <select
            id="fileType"
            name="fileType"
            value={fileType}
            disabled={enviando}
            onChange={(e) => {
              setFileType(e.target.value as PnpFileType);
              setResultado(null);
            }}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {gruposOrdenados.map(([grupo, itens]) => (
              <optgroup key={grupo} label={grupo}>
                {itens.map((item) => (
                  <option key={item.fileType} value={item.fileType}>
                    {item.subgrupo ? `${item.subgrupo} — ${item.label}` : item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-neutral-900 dark:text-neutral-100">
            Nome de arquivo sugerido:{" "}
            <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">{metadata.suggestedFileName}</code>
          </p>
          <p className="text-neutral-700 dark:text-neutral-300">{metadata.description}</p>

          <p className="text-neutral-600 dark:text-neutral-400">
            {ultimoUploadDoTipo ? (
              <>
                Último upload deste tipo:{" "}
                <strong>
                  {formatoData.format(new Date(ultimoUploadDoTipo.completedAt ?? ultimoUploadDoTipo.createdAt))}
                </strong>{" "}
                — {ultimoUploadDoTipo.rowCount ?? "?"} linha(s) importada(s) (
                <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
                  {ultimoUploadDoTipo.originalFilename}
                </code>
                )
              </>
            ) : (
              "Nenhum upload registrado ainda para este tipo de arquivo."
            )}
          </p>

          {!metadata.inScopeM1 && (
            <p className="rounded-md bg-amber-100 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Este arquivo ainda não entra em nenhum cálculo desta versão do sistema.
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p>
              <strong>O que este envio vai alterar no banco:</strong> os registros do tipo{" "}
              <strong>{metadata.label}</strong> (tabela <code>FatoIndicador</code>) são substituídos
              pelos deste arquivo, <strong>ano a ano</strong>. As tabelas <code>Instituicao</code> e{" "}
              <code>Unidade</code> são atualizadas (não apagadas), criando ou ajustando os registros
              que aparecerem no CSV.
            </p>
            <p>
              <strong>A importação é incremental.</strong> Os arquivos da PNP são cumulativos: o
              arquivo publicado num ano traz também todos os anos anteriores. Reimportar tudo
              reescreveria cerca de <strong>87% de dados idênticos</strong>. Para evitar isso, o
              sistema guarda uma <em>impressão digital</em> (um código calculado a partir do
              conteúdo) de cada ano já importado, compara com a do arquivo que você está enviando e{" "}
              <strong>só regrava os anos que realmente mudaram</strong>. Ao final, a tela mostra
              exatamente o que foi feito em cada ano.
            </p>
            <p>
              A comparação é pelo <strong>conteúdo</strong>, não pela data: se a PNP reprocessar e
              corrigir números de um ano antigo, aquele ano é detectado e reimportado sozinho. E se
              um ano deixar de aparecer no arquivo, ele é apagado do banco — o arquivo enviado
              continua sendo a fonte da verdade.
            </p>
            <p>
              <strong>Se algo falhar no meio:</strong> cada ano é gravado por inteiro ou não é
              gravado — nunca pela metade. Os anos concluídos antes da falha permanecem, e reenviar o
              mesmo arquivo retoma de onde parou, porque os anos já gravados aparecerão como
              inalterados.
            </p>
          </div>

          <div>
            <p className="mb-1 font-medium text-neutral-900 dark:text-neutral-100">Colunas esperadas:</p>
            <ul className="list-inside list-disc text-neutral-800 dark:text-neutral-200">
              {metadata.columns.map((coluna) => (
                <li key={coluna.header}>
                  {coluna.header}
                  {coluna.required && <span className="text-red-600 dark:text-red-400"> *</span>}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              * obrigatória. Pequenas variações no nome da coluna (maiúsculas, acentos, abreviações) são
              toleradas — o sistema não exige o nome exato.
            </p>
          </div>

          <button
            type="button"
            onClick={() => baixarModelo(fileType)}
            className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Baixar modelo CSV vazio
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="file" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Arquivo CSV
          </label>
          <div className="flex items-center gap-3 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
            <label
              htmlFor="file"
              className={`w-fit rounded-md border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-medium dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${
                enviando
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              Escolher arquivo
            </label>
            <span className="text-neutral-600 dark:text-neutral-400">
              {nomeArquivo ?? "Nenhum arquivo escolhido"}
            </span>
          </div>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv"
            required
            disabled={enviando}
            onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />
        </div>

        {enviando && (
          <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              {progressoUpload < 100 ? (
                <div
                  className="h-full rounded-full bg-neutral-900 transition-all dark:bg-neutral-100"
                  style={{ width: `${progressoUpload}%` }}
                />
              ) : (
                <div
                  className="h-full rounded-full bg-neutral-900 transition-all dark:bg-neutral-100"
                  style={{ width: `${progressoServidor && progressoServidor.total > 0 ? progressoServidorPercentual : 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <span>
                {progressoUpload < 100
                  ? `Enviando arquivo... ${progressoUpload}%`
                  : progressoServidor?.status === "deleting"
                    ? `Removendo os dados antigos${
                        progressoServidor.anoAtual ? ` do ano ${progressoServidor.anoAtual}` : ""
                      }... (a barra fica parada nessa fase, é esperado)`
                    : progressoServidor && progressoServidor.total > 0
                      ? `Importando registros${
                          progressoServidor.anoAtual ? ` — ano ${progressoServidor.anoAtual}` : ""
                        }: ${progressoServidor.processed}/${progressoServidor.total}`
                      : "Processando no servidor..."}
              </span>
              <span>{formatarTempo(segundosDecorridos)}</span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              A tela fica bloqueada para novas seleções de arquivo até a importação terminar.
            </p>
            <button
              type="button"
              onClick={handleCancelar}
              disabled={cancelando}
              className="w-fit rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              {cancelando ? "Cancelando — aguarde a confirmação..." : "Cancelar importação"}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {enviando ? "Enviando..." : "Enviar"}
        </button>

        {resultado && (
          <div
            className={`rounded-md p-4 text-sm ${
              resultado.ok
                ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
                : resultado.cancelled
                  ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200"
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
                {resultado.issues && resultado.issues.length > 0 && (
                  <ul className="mt-1 list-disc space-y-1 border-t border-green-200 pl-5 pt-1 dark:border-green-800">
                    {resultado.issues.map((issue, i) => (
                      <li key={i}>
                        {issue.rowIndex !== undefined && <>Linha {issue.rowIndex + 2}: </>}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
                {resultado.tabelasAfetadas && (
                  <p className="mt-1 border-t border-green-200 pt-1 dark:border-green-800">
                    Tabela <code>FatoIndicador</code>: {resultado.tabelasAfetadas.deletedFactCount}{" "}
                    registro(s) antigo(s) removido(s), {resultado.tabelasAfetadas.insertedFactCount} novo(s)
                    gravado(s). Tabela <code>Instituicao</code>: {resultado.tabelasAfetadas.instituicaoCount}{" "}
                    registro(s) tocado(s). Tabela <code>Unidade</code>: {resultado.tabelasAfetadas.unidadeCount}{" "}
                    registro(s) tocado(s).
                  </p>
                )}

                {resultado.anos && resultado.anos.length > 0 && (
                  <div className="mt-2 border-t border-green-200 pt-2 dark:border-green-800">
                    <p className="font-medium">O que a importação incremental fez em cada ano</p>
                    {resultado.tabelasAfetadas && (
                      <p className="mb-2">
                        {resultado.tabelasAfetadas.anosInalterados > 0 ? (
                          <>
                            <strong>{resultado.tabelasAfetadas.anosInalterados} ano(s)</strong> tinham
                            conteúdo idêntico ao que já estava no banco e{" "}
                            <strong>não foram regravados</strong>
                            {resultado.tabelasAfetadas.anosGravados > 0 ? (
                              <>
                                ; <strong>{resultado.tabelasAfetadas.anosGravados} ano(s)</strong> mudaram e
                                foram gravados.
                              </>
                            ) : (
                              <>. Nada precisou ser alterado no banco.</>
                            )}
                          </>
                        ) : (
                          <>
                            <strong>{resultado.tabelasAfetadas.anosGravados} ano(s)</strong> foram gravados —
                            nenhum ano do arquivo já estava no banco com o mesmo conteúdo.
                          </>
                        )}
                      </p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-green-200 dark:border-green-800">
                            <th className="py-1 pr-3 font-medium">Ano</th>
                            <th className="py-1 pr-3 font-medium">Situação</th>
                            <th className="py-1 pr-3 text-right font-medium">Linhas no arquivo</th>
                            <th className="py-1 pr-3 text-right font-medium">Removidos</th>
                            <th className="py-1 text-right font-medium">Gravados</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.anos.map((item) => (
                            <tr key={item.ano} className="border-b border-green-100 last:border-0 dark:border-green-900">
                              <td className="py-1 pr-3 tabular-nums">{item.ano}</td>
                              <td className="py-1 pr-3">
                                <span className={`rounded px-1.5 py-0.5 ${SITUACAO_ANO[item.resultado].classe}`}>
                                  {SITUACAO_ANO[item.resultado].rotulo}
                                </span>
                              </td>
                              <td className="py-1 pr-3 text-right tabular-nums">
                                {item.rowCount > 0 ? item.rowCount.toLocaleString("pt-BR") : "—"}
                              </td>
                              <td className="py-1 pr-3 text-right tabular-nums">
                                {item.deletedFactCount > 0 ? item.deletedFactCount.toLocaleString("pt-BR") : "—"}
                              </td>
                              <td className="py-1 text-right tabular-nums">
                                {item.insertedFactCount > 0 ? item.insertedFactCount.toLocaleString("pt-BR") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {(Object.keys(SITUACAO_ANO) as ResultadoAno[])
                        .filter((chave) => resultado.anos?.some((item) => item.resultado === chave))
                        .map((chave) => (
                          <li key={chave}>
                            <span className={`rounded px-1.5 py-0.5 ${SITUACAO_ANO[chave].classe}`}>
                              {SITUACAO_ANO[chave].rotulo}
                            </span>{" "}
                            — {SITUACAO_ANO[chave].explicacao}.
                          </li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs">
                      &quot;Linhas no arquivo&quot; conta as linhas do CSV daquele ano; &quot;removidos&quot; e
                      &quot;gravados&quot; contam registros da tabela <code>FatoIndicador</code>, que guarda{" "}
                      <strong>um registro por medida</strong> — por isso esses números são maiores que o de
                      linhas.
                    </p>
                  </div>
                )}
              </>
            ) : resultado.cancelled ? (
              <p>Importação cancelada. Nenhum dado foi alterado no banco.</p>
            ) : (
              <>
                <p>Erro: {resultado.errorMessage ?? "falha na validação do arquivo."}</p>
                {resultado.issues && resultado.issues.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {resultado.issues.map((issue, i) => (
                      <li key={i}>
                        {issue.rowIndex !== undefined && <>Linha {issue.rowIndex + 2}: </>}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
