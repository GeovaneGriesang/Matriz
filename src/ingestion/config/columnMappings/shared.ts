import type { ColumnDefinition } from "../mappingTypes";
import { identity, parseDecimalBr } from "../../parsing/transforms";

/**
 * Dimensões comuns a praticamente todo export da PNP: Ano, geografia e
 * identidade da instituição. A PNP não usa código numérico de instituição —
 * a chave é sempre `Instituicao` (sigla, ex: "IFB").
 */
export interface SharedDimensions {
  ano: number;
  regiao: string;
  uf: string;
  estado: string;
  organizacaoAcademica: string;
  instituicaoSigla: string;
  instituicaoNome: string;
}

export function sharedDimensionColumns(): { [K in keyof SharedDimensions]: ColumnDefinition<SharedDimensions[K]> } {
  return {
    ano: {
      sourceHeaderCandidates: ["Ano"],
      required: true,
      transform: parseDecimalBr,
      kind: "dimension",
    },
    regiao: {
      sourceHeaderCandidates: ["Região"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    uf: {
      sourceHeaderCandidates: ["UF"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    estado: {
      sourceHeaderCandidates: ["Estado"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    organizacaoAcademica: {
      sourceHeaderCandidates: ["Organização Acadêmica PNP"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    instituicaoSigla: {
      sourceHeaderCandidates: ["Instituicao"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    instituicaoNome: {
      sourceHeaderCandidates: ["Instituição (Nome)"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
  };
}

/** Dimensão de câmpus/unidade — presente na maioria dos arquivos, mas não em todos (ex: TaxaOcupacao é só por instituição). */
export const unidadeNomeColumn: ColumnDefinition<string> = {
  sourceHeaderCandidates: ["nomeUnidadeRecente"],
  required: true,
  transform: identity,
  kind: "dimension",
};
