import { PNP_FILE_TYPES, type PnpFileType } from "./fileTypes";
import type { ColumnMapping } from "./mappingTypes";
import { dadosGeraisMapping } from "./columnMappings/dadosGerais.mapping";
import { situacaoMatriculaMapping } from "./columnMappings/situacaoMatricula.mapping";
import { classificacaoRacialRendaSexoMapping } from "./columnMappings/classificacaoRacialRendaSexo.mapping";
import { percentuaisLegaisMapping } from "./columnMappings/percentuaisLegais.mapping";
import { reservaVagasMapping } from "./columnMappings/reservaVagas.mapping";
import { ofertaVagasNoturnasMapping } from "./columnMappings/ofertaVagasNoturnas.mapping";
import { relacaoInscritosVagasMapping } from "./columnMappings/relacaoInscritosVagas.mapping";
import { taxaEvasaoMapping } from "./columnMappings/taxaEvasao.mapping";
import { eficienciaAcademicaMapping } from "./columnMappings/eficienciaAcademica.mapping";
import { relacaoAlunoProfessorRapMapping } from "./columnMappings/relacaoAlunoProfessorRAP.mapping";
import { indiceVerticalizacaoMapping } from "./columnMappings/indiceVerticalizacao.mapping";
import { taxaOcupacaoMapping } from "./columnMappings/taxaOcupacao.mapping";
import { professoresPorInstituicaoMapping } from "./columnMappings/professoresPorInstituicao.mapping";
import { tecnicosAdmNivelMapping } from "./columnMappings/tecnicosAdmNivel.mapping";
import { titulacaoDocenteMapping } from "./columnMappings/titulacaoDocente.mapping";
import { indicadoresGastosMapping } from "./columnMappings/indicadoresGastos.mapping";
import { panoramaOrcamentarioMapping } from "./columnMappings/panoramaOrcamentario.mapping";
import { cargosCarreiraMapping } from "./columnMappings/cargosCarreira.mapping";

/**
 * Fonte única de verdade para "qual mapeamento de colunas corresponde a qual
 * tipo de arquivo PNP". Vive fora de pipeline.ts para poder ser importada por
 * componentes client (sem puxar node:crypto e outras dependências server-only).
 */
export const MAPPING_BY_FILE_TYPE: Record<PnpFileType, ColumnMapping<Record<string, unknown>>> = {
  DADOS_GERAIS: dadosGeraisMapping as ColumnMapping<Record<string, unknown>>,
  SITUACAO_MATRICULA: situacaoMatriculaMapping as ColumnMapping<Record<string, unknown>>,
  CLASSIFICACAO_RACIAL_RENDA_SEXO: classificacaoRacialRendaSexoMapping as ColumnMapping<
    Record<string, unknown>
  >,
  PERCENTUAIS_LEGAIS: percentuaisLegaisMapping as ColumnMapping<Record<string, unknown>>,
  RESERVA_VAGAS: reservaVagasMapping as ColumnMapping<Record<string, unknown>>,
  OFERTA_VAGAS_NOTURNAS: ofertaVagasNoturnasMapping as ColumnMapping<Record<string, unknown>>,
  RELACAO_INSCRITOS_VAGAS: relacaoInscritosVagasMapping as ColumnMapping<Record<string, unknown>>,
  TAXA_EVASAO: taxaEvasaoMapping as ColumnMapping<Record<string, unknown>>,
  EFICIENCIA_ACADEMICA: eficienciaAcademicaMapping as ColumnMapping<Record<string, unknown>>,
  RELACAO_ALUNO_PROFESSOR_RAP: relacaoAlunoProfessorRapMapping as ColumnMapping<Record<string, unknown>>,
  INDICE_VERTICALIZACAO: indiceVerticalizacaoMapping as ColumnMapping<Record<string, unknown>>,
  TAXA_OCUPACAO: taxaOcupacaoMapping as ColumnMapping<Record<string, unknown>>,
  PROFESSORES_POR_INSTITUICAO: professoresPorInstituicaoMapping as ColumnMapping<Record<string, unknown>>,
  TECNICOS_ADM_NIVEL: tecnicosAdmNivelMapping as ColumnMapping<Record<string, unknown>>,
  TITULACAO_DOCENTE: titulacaoDocenteMapping as ColumnMapping<Record<string, unknown>>,
  INDICADORES_GASTOS: indicadoresGastosMapping as ColumnMapping<Record<string, unknown>>,
  PANORAMA_ORCAMENTARIO: panoramaOrcamentarioMapping as ColumnMapping<Record<string, unknown>>,
  CARGOS_CARREIRA: cargosCarreiraMapping as ColumnMapping<Record<string, unknown>>,
};

export interface FileTypeMetadata {
  fileType: PnpFileType;
  label: string;
  grupo: string;
  subgrupo?: string;
  suggestedFileName: string;
  description: string;
  inScopeM1: boolean;
  columns: { header: string; required: boolean }[];
}

const LABEL: Record<PnpFileType, string> = {
  DADOS_GERAIS: "Dados Gerais (Curso, Matrícula e Oferta)",
  SITUACAO_MATRICULA: "Situação de Matrícula",
  CLASSIFICACAO_RACIAL_RENDA_SEXO: "Classificação Racial, Renda e Sexo",
  PERCENTUAIS_LEGAIS: "Percentuais Legais",
  RESERVA_VAGAS: "Reserva de Vagas",
  OFERTA_VAGAS_NOTURNAS: "Oferta de Vagas Noturnas",
  RELACAO_INSCRITOS_VAGAS: "Relação Inscritos/Vagas",
  TAXA_EVASAO: "Taxa de Evasão",
  EFICIENCIA_ACADEMICA: "Eficiência Acadêmica (IEA)",
  RELACAO_ALUNO_PROFESSOR_RAP: "Relação Aluno/Professor (RAP)",
  INDICE_VERTICALIZACAO: "Índice de Verticalização",
  TAXA_OCUPACAO: "Taxa de Ocupação",
  PROFESSORES_POR_INSTITUICAO: "Professores por Instituição",
  TECNICOS_ADM_NIVEL: "Técnicos Administrativos por Nível",
  TITULACAO_DOCENTE: "Titulação Docente",
  INDICADORES_GASTOS: "Indicadores de Gastos",
  PANORAMA_ORCAMENTARIO: "Panorama Orçamentário",
  CARGOS_CARREIRA: "Cargos e Carreira",
};

const GRUPO: Record<PnpFileType, string> = {
  DADOS_GERAIS: "1 - Indicadores de gestão",
  SITUACAO_MATRICULA: "1 - Indicadores de gestão",
  CLASSIFICACAO_RACIAL_RENDA_SEXO: "1 - Indicadores de gestão",
  PERCENTUAIS_LEGAIS: "1 - Indicadores de gestão",
  RESERVA_VAGAS: "1 - Indicadores de gestão",
  OFERTA_VAGAS_NOTURNAS: "1 - Indicadores de gestão",
  RELACAO_INSCRITOS_VAGAS: "1 - Indicadores de gestão",
  TAXA_EVASAO: "1 - Indicadores de gestão",
  EFICIENCIA_ACADEMICA: "1 - Indicadores de gestão",
  RELACAO_ALUNO_PROFESSOR_RAP: "1 - Indicadores de gestão",
  INDICE_VERTICALIZACAO: "1 - Indicadores de gestão",
  TAXA_OCUPACAO: "1 - Indicadores de gestão",
  PROFESSORES_POR_INSTITUICAO: "1 - Indicadores de gestão",
  TECNICOS_ADM_NIVEL: "1 - Indicadores de gestão",
  TITULACAO_DOCENTE: "1 - Indicadores de gestão",
  INDICADORES_GASTOS: "1 - Indicadores de gestão",
  PANORAMA_ORCAMENTARIO: "2 - Dados orçamentários",
  CARGOS_CARREIRA: "3 - Dados de Gestão de Pessoas",
};

const SUBGRUPO: Partial<Record<PnpFileType, string>> = {
  DADOS_GERAIS: "1 - Dados Acadêmicos",
  SITUACAO_MATRICULA: "1 - Dados Acadêmicos",
  CLASSIFICACAO_RACIAL_RENDA_SEXO: "1 - Dados Acadêmicos",
  PERCENTUAIS_LEGAIS: "2 - Percentuais Legais",
  RESERVA_VAGAS: "2 - Percentuais Legais",
  OFERTA_VAGAS_NOTURNAS: "2 - Percentuais Legais",
  RELACAO_INSCRITOS_VAGAS: "2 - Percentuais Legais",
  TAXA_EVASAO: "3 - Indicadores Acadêmicos",
  EFICIENCIA_ACADEMICA: "3 - Indicadores Acadêmicos",
  RELACAO_ALUNO_PROFESSOR_RAP: "3 - Indicadores Acadêmicos",
  INDICE_VERTICALIZACAO: "3 - Indicadores Acadêmicos",
  TAXA_OCUPACAO: "3 - Indicadores Acadêmicos",
  PROFESSORES_POR_INSTITUICAO: "4 - Indicadores de Pessoal",
  TECNICOS_ADM_NIVEL: "4 - Indicadores de Pessoal",
  TITULACAO_DOCENTE: "4 - Indicadores de Pessoal",
  INDICADORES_GASTOS: "5 - Indicadores de Gastos",
  // PANORAMA_ORCAMENTARIO e CARGOS_CARREIRA não têm subgrupo — ficam direto no grupo.
};

const SUGGESTED_FILE_NAME: Record<PnpFileType, string> = {
  DADOS_GERAIS: "DadosGerais.csv",
  SITUACAO_MATRICULA: "SituacaoMatricula.csv",
  CLASSIFICACAO_RACIAL_RENDA_SEXO: "ClassificacaoRacialRendaSexo.csv",
  PERCENTUAIS_LEGAIS: "PercentuaisLegais.csv",
  RESERVA_VAGAS: "ReservaVagas.csv",
  OFERTA_VAGAS_NOTURNAS: "OfertaVagasNoturnas.csv",
  RELACAO_INSCRITOS_VAGAS: "RelacaoInscritosVagas.csv",
  TAXA_EVASAO: "TaxaEvasao.csv",
  EFICIENCIA_ACADEMICA: "EficienciaAcademica.csv",
  RELACAO_ALUNO_PROFESSOR_RAP: "RelacaoAlunoProfessorRAP.csv",
  INDICE_VERTICALIZACAO: "IndiceVerticalizacao.csv",
  TAXA_OCUPACAO: "TaxaOcupacao.csv",
  PROFESSORES_POR_INSTITUICAO: "ProfessoresPorInstituicao.csv",
  TECNICOS_ADM_NIVEL: "TecnicosAdmNivel.csv",
  TITULACAO_DOCENTE: "TitulacaoDocente.csv",
  INDICADORES_GASTOS: "IndicadoresGastos.csv",
  PANORAMA_ORCAMENTARIO: "PanoramaOrcamentario.csv",
  CARGOS_CARREIRA: "CargosCarreira.csv",
};

const DESCRIPTION: Record<PnpFileType, string> = {
  DADOS_GERAIS:
    "Cursos, matrículas e oferta por câmpus: número de cursos, concluintes, ingressantes, inscritos, matrículas, vagas e a Matrícula Equivalente oficial da PNP. Fonte da Matrícula Ponderada usada no Bloco de Funcionamento (80% do orçamento).",
  SITUACAO_MATRICULA:
    "Número de matrículas por situação (concluídas, em curso, evadidas, retidas) por câmpus. Ainda não entra em nenhum cálculo desta versão.",
  CLASSIFICACAO_RACIAL_RENDA_SEXO:
    "Dados demográficos e de renda familiar por matrícula (cor/raça, sexo, faixa etária, renda). Reservado para o Bloco de Assistência Estudantil de uma etapa futura.",
  PERCENTUAIS_LEGAIS:
    "Matrícula Equivalente por meta legal (Técnicos, Formação de Professores, PROEJA) por câmpus. Usado no Índice de Atendimento aos Percentuais Legais (IAPL), parte do Bloco de Qualidade e Eficiência.",
  RESERVA_VAGAS:
    "Vagas regulares por tipo de reserva (ampla concorrência, cota) por câmpus. Ainda não entra em nenhum cálculo desta versão.",
  OFERTA_VAGAS_NOTURNAS:
    "Oferta de vagas em cursos noturnos e de graduação por câmpus. Ainda não entra em nenhum cálculo desta versão.",
  RELACAO_INSCRITOS_VAGAS:
    "Relação candidato/vaga (inscritos ÷ vagas) por câmpus. Ainda não entra em nenhum cálculo desta versão.",
  TAXA_EVASAO:
    "Matrículas e evasão por curso (tipo, eixo tecnológico, turno, modalidade, fonte de financiamento). Ainda não entra em nenhum cálculo desta versão.",
  EFICIENCIA_ACADEMICA:
    "Índice de Eficiência Acadêmica (IEA) e indicadores relacionados (concluídos, evadidos, retidos) por câmpus/ano. Usado no Bloco de Qualidade e Eficiência (10% do orçamento).",
  RELACAO_ALUNO_PROFESSOR_RAP:
    "Razão Aluno/Professor (RAP) já calculada pela PNP, por câmpus/ano. Usada no Bloco de Qualidade e Eficiência.",
  INDICE_VERTICALIZACAO:
    "Índice de Verticalização (vagas por nível: graduação, técnico, pós-graduação, qualificação) por câmpus. Ainda não entra em nenhum cálculo desta versão.",
  TAXA_OCUPACAO:
    "Taxa de ocupação de vagas (matrículas ÷ vagas) por instituição. Ainda não entra em nenhum cálculo desta versão.",
  PROFESSORES_POR_INSTITUICAO:
    "Número de docentes por titulação e jornada de trabalho, por instituição. Ainda não entra em nenhum cálculo desta versão.",
  TECNICOS_ADM_NIVEL:
    "Número de técnicos administrativos por titulação, por instituição. Ainda não entra em nenhum cálculo desta versão.",
  TITULACAO_DOCENTE:
    "Índice de Titulação do Corpo Docente (ITCD) e contagens de docentes/servidores por instituição. Ainda não entra em nenhum cálculo desta versão.",
  INDICADORES_GASTOS:
    "Gastos correntes (pessoal, custeio, investimentos, inativos e pensionistas, precatórios) por instituição. Ainda não entra em nenhum cálculo desta versão.",
  PANORAMA_ORCAMENTARIO:
    "Execução orçamentária (dotação, empenhado, liquidado, pago, crédito disponível) por instituição, órgão e resultado primário. Ainda não entra em nenhum cálculo desta versão.",
  CARGOS_CARREIRA:
    "Número de servidores por carreira (SIAFI), por instituição. Ainda não entra em nenhum cálculo desta versão.",
};

const IN_SCOPE_M1: Record<PnpFileType, boolean> = {
  DADOS_GERAIS: true,
  SITUACAO_MATRICULA: false,
  CLASSIFICACAO_RACIAL_RENDA_SEXO: false,
  PERCENTUAIS_LEGAIS: true,
  RESERVA_VAGAS: false,
  OFERTA_VAGAS_NOTURNAS: false,
  RELACAO_INSCRITOS_VAGAS: false,
  TAXA_EVASAO: false,
  EFICIENCIA_ACADEMICA: true,
  RELACAO_ALUNO_PROFESSOR_RAP: true,
  INDICE_VERTICALIZACAO: false,
  TAXA_OCUPACAO: false,
  PROFESSORES_POR_INSTITUICAO: false,
  TECNICOS_ADM_NIVEL: false,
  TITULACAO_DOCENTE: false,
  INDICADORES_GASTOS: false,
  PANORAMA_ORCAMENTARIO: false,
  CARGOS_CARREIRA: false,
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
    grupo: GRUPO[fileType],
    subgrupo: SUBGRUPO[fileType],
    suggestedFileName: SUGGESTED_FILE_NAME[fileType],
    description: DESCRIPTION[fileType],
    inScopeM1: IN_SCOPE_M1[fileType],
    columns,
  };
}

export const ALL_FILE_TYPE_METADATA: FileTypeMetadata[] = PNP_FILE_TYPES.map(getFileTypeMetadata);
