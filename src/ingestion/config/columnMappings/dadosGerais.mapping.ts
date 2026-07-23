import type { ColumnMapping } from "../mappingTypes";
import { identity, parseDecimalBrOptional } from "../../parsing/transforms";
import { sharedDimensionColumns, unidadeNomeColumn, type SharedDimensions } from "./shared";

/** DadosGerais.csv — cadastro de curso, matrícula e oferta por câmpus/curso. */
export interface DadosGeraisRow extends SharedDimensions {
  unidadeNome: string;
  nomeIdCurso: string;
  tipoCurso: string;
  tipoOferta: string;
  modalidadeEnsino: string;
  numeroCursos: number | null;
  numeroConcluintes: number | null;
  numeroIngressantes: number | null;
  numeroInscritos: number | null;
  numeroMatriculas: number | null;
  numeroVagas: number | null;
  matriculaEquivalenteGeral: number | null;
}

export const dadosGeraisMapping: ColumnMapping<DadosGeraisRow> = {
  fileType: "DADOS_GERAIS",
  columns: {
    ...sharedDimensionColumns(),
    unidadeNome: unidadeNomeColumn,
    nomeIdCurso: {
      sourceHeaderCandidates: ["nomeIdCurso"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    tipoCurso: {
      sourceHeaderCandidates: ["tipoCurso"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    tipoOferta: {
      sourceHeaderCandidates: ["tipoOferta"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    modalidadeEnsino: {
      sourceHeaderCandidates: ["ModalidadeEnsino"],
      required: true,
      transform: identity,
      kind: "dimension",
    },
    numeroCursos: {
      sourceHeaderCandidates: ["Número de cursos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de cursos",
    },
    numeroConcluintes: {
      sourceHeaderCandidates: ["Número de concluintes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de concluintes",
    },
    numeroIngressantes: {
      sourceHeaderCandidates: ["Número de ingressantes"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de ingressantes",
    },
    numeroInscritos: {
      sourceHeaderCandidates: ["Número de inscritos"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de inscritos",
    },
    numeroMatriculas: {
      sourceHeaderCandidates: ["Número de Matrículas"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de Matrículas",
    },
    numeroVagas: {
      sourceHeaderCandidates: ["Número de vagas"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Número de vagas",
    },
    matriculaEquivalenteGeral: {
      sourceHeaderCandidates: ["Matrícula Equivalente | Geral"],
      required: true,
      transform: parseDecimalBrOptional,
      kind: "measure",
      measureLabel: "Matrícula Equivalente | Geral",
    },
  },
};
