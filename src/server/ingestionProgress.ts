/**
 * Progresso de importação em memória, indexado por `uploadId` (gerado no
 * cliente a cada envio). Serve dois propósitos: relatar ao cliente quantas
 * linhas já foram processadas (via polling em `/api/uploads/progress`) e
 * receber pedidos de cancelamento (`/api/uploads/cancel`), consultados pelo
 * pipeline de ingestão a cada linha processada. Vive só no processo Node do
 * servidor — suficiente para o uso local/single-instance deste sistema.
 */
export type IngestionStatus = "parsing" | "persisting" | "done" | "error" | "cancelled";

export interface IngestionProgressState {
  total: number;
  processed: number;
  status: IngestionStatus;
  cancelRequested: boolean;
  startedAt: number;
  errorMessage?: string;
}

const TTL_MS = 5 * 60 * 1000;

const store = new Map<string, IngestionProgressState>();

export function iniciarProgresso(uploadId: string): void {
  store.set(uploadId, {
    total: 0,
    processed: 0,
    status: "parsing",
    cancelRequested: false,
    startedAt: Date.now(),
  });
}

export function atualizarProgresso(uploadId: string, patch: Partial<IngestionProgressState>): void {
  const atual = store.get(uploadId);
  if (!atual) return;
  store.set(uploadId, { ...atual, ...patch });
}

export function obterProgresso(uploadId: string): IngestionProgressState | undefined {
  return store.get(uploadId);
}

export function solicitarCancelamento(uploadId: string): boolean {
  const atual = store.get(uploadId);
  if (!atual) return false;
  store.set(uploadId, { ...atual, cancelRequested: true });
  return true;
}

export function cancelamentoFoiSolicitado(uploadId: string | undefined): boolean {
  if (!uploadId) return false;
  return store.get(uploadId)?.cancelRequested ?? false;
}

export function finalizarProgresso(uploadId: string, status: "done" | "error" | "cancelled", errorMessage?: string): void {
  atualizarProgresso(uploadId, { status, errorMessage });
  setTimeout(() => store.delete(uploadId), TTL_MS);
}
