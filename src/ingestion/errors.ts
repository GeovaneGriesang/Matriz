/** Lançado quando o usuário cancela uma importação em andamento — interrompe a transação, revertendo tudo. */
export class IngestionCancelledError extends Error {
  constructor() {
    super("Importação cancelada pelo usuário.");
    this.name = "IngestionCancelledError";
  }
}
