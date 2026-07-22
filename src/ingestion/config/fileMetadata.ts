import { PNP_FILE_TYPES, type PnpFileType } from "./fileTypes";
import type { ColumnMapping } from "./mappingTypes";
import { dadosGeraisMapping } from "./columnMappings/dadosGerais.mapping";
import { eficienciaAcademicaMapping } from "./columnMappings/eficienciaAcademica.mapping";
import { relacaoAlunoProfessorRapMapping } from "./columnMappings/relacaoAlunoProfessorRAP.mapping";
import { percentuaisLegaisMapping } from "./columnMappings/percentuaisLegais.mapping";
import { classificacaoRacialRendaSexoMapping } from "./columnMappings/classificacaoRacialRendaSexo.mapping";
import { situacaoMatriculaMapping } from "./columnMappings/situacaoMatricula.mapping";

/**
 * Fonte única de verdade para "qual mapeamento de colunas corresponde a qual
 * tipo de arquivo PNP". Vive fora de pipeline.ts para poder ser importada por
 * componentes client (sem puxar node:crypto e outras dependências server-only).
 */
export const MAPPING_BY_FILE_TYPE: Record<PnpFileType, ColumnMapping<Record<string, unknown>>> = {
  DADOS_GERAIS: dadosGeraisMapping as ColumnMapping<Record<string, unknown>>,
  EFICIENCIA_ACADEMICA: eficienciaAcademicaMapping as ColumnMapping<Record<string, unknown>>,
  RELACAO_ALUNO_PROFESSOR_RAP: relacaoAlunoProfessorRapMapping as ColumnMapping<Record<string, unknown>>,
  PERCENTUAIS_LEGAIS: percentuaisLegaisMapping as ColumnMapping<Record<string, unknown>>,
  CLASSIFICACAO_RACIAL_RENDA_SEXO: classificacaoRacialRendaSexoMapping as ColumnMapping<
    Record<string, unknown>
  >,
  SITUACAO_MATRICULA: situacaoMatriculaMapping as ColumnMapping<Record<string, unknown>>,
};

export interface FileTypeMetadata {
  fileType: PnpFileType;
  label: string;
  suggestedFileName: string;
  description: string;
  inScopeM1: boolean;
  columns: { header: string; required: boolean }[];
}

const LABEL: Record<PnpFileType, string> = {
  DADOS_GERAIS: "Dados Gerais",
  SITUACAO_MATRICULA: "Situação de Matrícula",
  EFICIENCIA_ACADEMICA: "Eficiência Acadêmica (IEA)",
  RELACAO_ALUNO_PROFESSOR_RAP: "Relação Aluno/Professor (RAP)",
  PERCENTUAIS_LEGAIS: "Percentuais Legais (IAPL)",
  CLASSIFICACAO_RACIAL_RENDA_SEXO: "Classificação Racial, Renda e Sexo",
};

const SUGGESTED_FILE_NAME: Record<PnpFileType, string> = {
  DADOS_GERAIS: "DadosGerais.csv",
  SITUACAO_MATRICULA: "SituacaoMatricula.csv",
  EFICIENCIA_ACADEMICA: "EficienciaAcademica.csv",
  RELACAO_ALUNO_PROFESSOR_RAP: "RelacaoAlunoProfessorRAP.csv",
  PERCENTUAIS_LEGAIS: "PercentuaisLegais.csv",
  CLASSIFICACAO_RACIAL_RENDA_SEXO: "ClassificacaoRacialRendaSexo.csv",
};

const DESCRIPTION: Record<PnpFileType, string> = {
  DADOS_GERAIS:
    "Cadastro de referência: quais autarquias, câmpus e cursos existem. Envie este arquivo primeiro — os demais dependem dos códigos de câmpus/curso cadastrados aqui.",
  SITUACAO_MATRICULA:
    "Matrícula equivalente (Mateq) e datas do ciclo por matrícula. É a base da Matrícula Ponderada, usada no Bloco de Funcionamento (80% do orçamento).",
  EFICIENCIA_ACADEMICA:
    "Índice de Eficiência Acadêmica (IEA) por câmpus/ano. Usado no Bloco de Qualidade e Eficiência (10% do orçamento).",
  RELACAO_ALUNO_PROFESSOR_RAP:
    "Quantidade de docentes por regime de trabalho e alunos presenciais por câmpus/ano. Usado para calcular a Relação Aluno/Professor (RAP), parte do Bloco de Qualidade e Eficiência.",
  PERCENTUAIS_LEGAIS:
    "Matrículas por meta legal (Técnicos, Formação de Professores, PROEJA) por câmpus/ano. Usado no Índice de Atendimento aos Percentuais Legais (IAPL), parte do Bloco de Qualidade e Eficiência.",
  CLASSIFICACAO_RACIAL_RENDA_SEXO:
    "Dados demográficos e de renda familiar por matrícula. Ainda NÃO entra em nenhum cálculo desta versão — está reservado para o Bloco de Assistência Estudantil de uma etapa futura. Pode enviar para já validar o arquivo, mas ele não muda nenhum resultado hoje.",
};

const IN_SCOPE_M1: Record<PnpFileType, boolean> = {
  DADOS_GERAIS: true,
  SITUACAO_MATRICULA: true,
  EFICIENCIA_ACADEMICA: true,
  RELACAO_ALUNO_PROFESSOR_RAP: true,
  PERCENTUAIS_LEGAIS: true,
  CLASSIFICACAO_RACIAL_RENDA_SEXO: false,
};

export function getFileTypeMetadata(fileType: PnpFileType): FileTypeMetadata {
  const mapping = MAPPING_BY_FILE_TYPE[fileType];
  const columns = Object.values(mapping.columns).map((def) => ({
    header: def.sourceHeaderCandidates[0] ?? "",
    required: def.required,
  }));

  return {
    fileType,
    label: LABEL[fileType],
    suggestedFileName: SUGGESTED_FILE_NAME[fileType],
    description: DESCRIPTION[fileType],
    inScopeM1: IN_SCOPE_M1[fileType],
    columns,
  };
}

export const ALL_FILE_TYPE_METADATA: FileTypeMetadata[] = PNP_FILE_TYPES.map(getFileTypeMetadata);
