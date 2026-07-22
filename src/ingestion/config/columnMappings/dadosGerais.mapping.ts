import type { ColumnMapping } from "../mappingTypes";
import { identity } from "../../parsing/transforms";

/**
 * DadosGerais.csv — dado de referência (autarquia/câmpus/curso).
 * TODO: verificar os nomes exatos de coluna contra um export real da PNP ou
 * a Portaria MEC 646/2022. Nomes abaixo são best-guess a partir do PRD.
 */
export interface DadosGeraisRow {
  siglaAutarquia: string;
  nomeAutarquia: string;
  codigoCampus: string;
  nomeCampus: string;
  codigoCurso: string;
  nomeCurso: string;
  eixoTecnologico: string;
  nivel: string;
  modalidade: string;
}

export const dadosGeraisMapping: ColumnMapping<DadosGeraisRow> = {
  fileType: "DADOS_GERAIS",
  columns: {
    siglaAutarquia: {
      sourceHeaderCandidates: ["Sigla_Autarquia", "SIGLA_IF", "Instituição"],
      required: true,
      transform: identity,
    },
    nomeAutarquia: {
      sourceHeaderCandidates: ["Nome_Autarquia", "Instituto Federal", "Nome_IF"],
      required: true,
      transform: identity,
    },
    codigoCampus: {
      sourceHeaderCandidates: ["Codigo_Campus", "CO_CAMPUS", "Código do Câmpus"],
      required: true,
      transform: identity,
    },
    nomeCampus: {
      sourceHeaderCandidates: ["Nome_Campus", "NO_CAMPUS", "Câmpus"],
      required: true,
      transform: identity,
    },
    codigoCurso: {
      sourceHeaderCandidates: ["Codigo_Curso", "CO_CURSO", "Código do Curso"],
      required: true,
      transform: identity,
    },
    nomeCurso: {
      sourceHeaderCandidates: ["Nome_Curso", "NO_CURSO", "Curso"],
      required: true,
      transform: identity,
    },
    eixoTecnologico: {
      sourceHeaderCandidates: ["Eixo_Tecnologico", "EIXO_TECNOLOGICO", "Eixo Tecnológico"],
      required: true,
      transform: identity,
    },
    nivel: {
      sourceHeaderCandidates: ["Nivel_Curso", "NIVEL_CURSO", "Nível"],
      required: true,
      transform: identity,
    },
    modalidade: {
      sourceHeaderCandidates: ["Modalidade_Ensino", "MODALIDADE", "Modalidade"],
      required: true,
      transform: identity,
    },
  },
};
