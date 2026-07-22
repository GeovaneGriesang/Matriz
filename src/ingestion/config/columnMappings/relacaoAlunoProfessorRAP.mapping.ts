import type { ColumnMapping } from "../mappingTypes";
import { identity, parseInteiro } from "../../parsing/transforms";

/**
 * RelacaoAlunoProfessorRAP.csv — docentes por regime de trabalho e alunos presenciais, por câmpus/ano.
 * TODO: verificar os nomes exatos de coluna contra um export real da PNP ou
 * a Portaria MEC 646/2022. Nomes abaixo são best-guess a partir do PRD.
 */
export interface RelacaoAlunoProfessorRapRow {
  codigoCampus: string;
  regimeTrabalho: string;
  quantidadeDocentes: number;
  alunosPresenciais: number;
  referenciaAno: number;
}

export const relacaoAlunoProfessorRapMapping: ColumnMapping<RelacaoAlunoProfessorRapRow> = {
  fileType: "RELACAO_ALUNO_PROFESSOR_RAP",
  columns: {
    codigoCampus: {
      sourceHeaderCandidates: ["Codigo_Campus", "CO_CAMPUS", "Código do Câmpus"],
      required: true,
      transform: identity,
    },
    regimeTrabalho: {
      sourceHeaderCandidates: ["Regime_Trabalho", "REGIME_TRABALHO", "Regime de Trabalho"],
      required: true,
      transform: identity,
    },
    quantidadeDocentes: {
      sourceHeaderCandidates: ["Qtd_Docentes", "QT_DOCENTES", "Quantidade de Docentes"],
      required: true,
      transform: parseInteiro,
    },
    alunosPresenciais: {
      sourceHeaderCandidates: ["Alunos_Presenciais", "QT_ALUNOS_PRESENCIAL", "Alunos Presenciais"],
      required: true,
      transform: parseInteiro,
    },
    referenciaAno: {
      sourceHeaderCandidates: ["Ano", "ANO_REFERENCIA", "Ano_Referencia"],
      required: true,
      transform: parseInteiro,
    },
  },
};
