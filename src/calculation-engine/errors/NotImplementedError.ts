/**
 * Sinaliza uma regra da metodologia que é conhecida mas que não pode ser implementada ainda por
 * falta de confirmação de uma fonte externa (CONIF/SETEC/PNP) — nunca deve ser capturada e
 * substituída por uma aproximação silenciosa. Ver docs/pnp-matriz/Metodologia_Matriz_Orcamentaria_CONIF.md,
 * seção 9.
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}
