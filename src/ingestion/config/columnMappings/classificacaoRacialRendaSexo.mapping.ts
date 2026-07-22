import type { ColumnMapping } from "../mappingTypes";
import { identity } from "../../parsing/transforms";

/**
 * CassificacaoRacialRendaSexo.csv — dados demográficos e de renda per capita por
 * matrícula, usados na M2 para o Bloco de Assistência Estudantil (Ação 2994).
 * Fora do escopo de cálculo da M1 — ingerido/validado, mas ainda sem tabela de
 * persistência dedicada (ver Pendências do plano de M1).
 * TODO: verificar os nomes exatos de coluna contra um export real da PNP ou
 * a Portaria MEC 646/2022. Nomes abaixo são best-guess a partir do PRD.
 */
export interface ClassificacaoRacialRendaSexoRow {
  codigoCampus: string;
  codigoCurso: string;
  classificacaoRacial: string;
  sexo: string;
  faixaRendaFamiliarPerCapita: string;
}

export const classificacaoRacialRendaSexoMapping: ColumnMapping<ClassificacaoRacialRendaSexoRow> = {
  fileType: "CLASSIFICACAO_RACIAL_RENDA_SEXO",
  columns: {
    codigoCampus: {
      sourceHeaderCandidates: ["Codigo_Campus", "CO_CAMPUS", "Código do Câmpus"],
      required: true,
      transform: identity,
    },
    codigoCurso: {
      sourceHeaderCandidates: ["Codigo_Curso", "CO_CURSO", "Código do Curso"],
      required: true,
      transform: identity,
    },
    classificacaoRacial: {
      sourceHeaderCandidates: ["Cor_Raca", "TP_COR_RACA", "Classificação Racial"],
      required: false,
      transform: identity,
    },
    sexo: {
      sourceHeaderCandidates: ["Sexo", "TP_SEXO"],
      required: false,
      transform: identity,
    },
    faixaRendaFamiliarPerCapita: {
      sourceHeaderCandidates: ["Faixa_Renda_Familiar_Per_Capita", "RENDA_FAMILIAR_PER_CAPITA", "Faixa RFP"],
      required: false,
      transform: identity,
    },
  },
};
