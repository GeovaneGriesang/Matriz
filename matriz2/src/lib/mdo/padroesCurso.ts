import { chMatrizPorRegra, ehQualificacaoProfissional } from "./regrasCiclo";

/**
 * Valores sugeridos para um curso novo, segundo o tipo e a oferta: quanto costuma durar, qual a carga horária e qual o
 * teto de carga horária que a MDO paga. São só pontos de partida; a tela deixa mudar tudo.
 */
export interface PadroesDoCurso {
  anosDuracao: number;
  /** Para o que dura menos de um ano (FIC, especialização). */
  mesesDuracao?: number;
  /** CH total sugerida para a turma. */
  chTotal: number;
  /** Teto de CH da matriz: acima disso as horas não rendem. Sem teto fixo (FIC, doutorado), um valor alto. */
  teto: number;
  vagasPorAno: number;
}

/** Sem teto fixo, a MDO usa a CH do próprio ciclo: o simulador não limita. */
export const SEM_TETO_DE_CH = 6000;

export function padroesDoCurso(tipoCurso: string, tipoOferta: string, chMinimaMec: number): PadroesDoCurso {
  const tipo = tipoCurso.toUpperCase();
  const oferta = tipoOferta.toUpperCase();
  const teto = chMatrizPorRegra(tipo, oferta, 0, chMinimaMec) || SEM_TETO_DE_CH;
  const mec = chMinimaMec > 0 ? chMinimaMec : 800;

  if (ehQualificacaoProfissional(tipo)) {
    // As cargas de 1.600, 2.400 e 3.200 h que aparecem no catálogo de FIC são valores padrão da MDO, não a duração real.
    return { anosDuracao: 1, mesesDuracao: 4, chTotal: mec > 800 ? 160 : mec, teto, vagasPorAno: 40 };
  }
  if (tipo === "TECNICO") {
    if (oferta.includes("PROEJA")) return { anosDuracao: 3, chTotal: teto, teto, vagasPorAno: 40 };
    if (oferta === "INTEGRADO") return { anosDuracao: 4, chTotal: teto, teto, vagasPorAno: 40 };
    return { anosDuracao: 2, chTotal: mec, teto, vagasPorAno: 40 };
  }
  if (tipo === "BACHARELADO") return { anosDuracao: mec >= 3600 ? 5 : 4, chTotal: mec, teto, vagasPorAno: 40 };
  if (tipo === "LICENCIATURA") return { anosDuracao: 4, chTotal: mec, teto, vagasPorAno: 40 };
  if (tipo === "TECNOLOGIA") return { anosDuracao: 3, chTotal: mec, teto, vagasPorAno: 40 };
  if (tipo.startsWith("ESPECIALIZACAO")) return { anosDuracao: 2, mesesDuracao: 18, chTotal: mec, teto, vagasPorAno: 30 };
  if (tipo.startsWith("MESTRADO")) return { anosDuracao: 2, chTotal: mec, teto, vagasPorAno: 15 };
  if (tipo === "DOUTORADO") return { anosDuracao: 4, chTotal: mec, teto, vagasPorAno: 10 };
  return { anosDuracao: 2, chTotal: mec, teto, vagasPorAno: 40 };
}
