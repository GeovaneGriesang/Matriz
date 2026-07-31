-- Views geradas automaticamente por scripts/generatePnpViews.ts a partir de MAPPING_BY_FILE_TYPE.
-- Não editar à mão — reexecutar o script e criar uma nova migration se os mapeamentos mudarem.
-- Uma view por tipo de arquivo PNP, "wide" (uma coluna por medida) em vez do formato longo de
-- FatoIndicador, para permitir consulta e JOIN direto no MySQL (Workbench, mysql CLI etc.).

-- DADOS_GERAIS: 7 medida(s), 4 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_dados_gerais` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.nomeIdCurso' AS `nomeIdCurso`,
  f.dimensoesExtra ->> '$.tipoCurso' AS `tipoCurso`,
  f.dimensoesExtra ->> '$.tipoOferta' AS `tipoOferta`,
  f.dimensoesExtra ->> '$.modalidadeEnsino' AS `modalidadeEnsino`,
  MAX(CASE WHEN f.medida = 'Número de cursos' THEN f.valor END) AS `numeroCursos`,
  MAX(CASE WHEN f.medida = 'Número de concluintes' THEN f.valor END) AS `numeroConcluintes`,
  MAX(CASE WHEN f.medida = 'Número de ingressantes' THEN f.valor END) AS `numeroIngressantes`,
  MAX(CASE WHEN f.medida = 'Número de inscritos' THEN f.valor END) AS `numeroInscritos`,
  MAX(CASE WHEN f.medida = 'Número de Matrículas' THEN f.valor END) AS `numeroMatriculas`,
  MAX(CASE WHEN f.medida = 'Número de vagas' THEN f.valor END) AS `numeroVagas`,
  MAX(CASE WHEN f.medida = 'Matrícula Equivalente | Geral' THEN f.valor END) AS `matriculaEquivalenteGeral`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'DADOS_GERAIS'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.nomeIdCurso',
  f.dimensoesExtra ->> '$.tipoCurso',
  f.dimensoesExtra ->> '$.tipoOferta',
  f.dimensoesExtra ->> '$.modalidadeEnsino'
;

-- SITUACAO_MATRICULA: 1 medida(s), 3 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_situacao_matricula` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.categoriaSituacao' AS `categoriaSituacao`,
  f.dimensoesExtra ->> '$.nomeSituacao' AS `nomeSituacao`,
  f.dimensoesExtra ->> '$.fluxoRetido' AS `fluxoRetido`,
  MAX(CASE WHEN f.medida = 'Número de Matrículas' THEN f.valor END) AS `numeroMatriculas`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'SITUACAO_MATRICULA'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.categoriaSituacao',
  f.dimensoesExtra ->> '$.nomeSituacao',
  f.dimensoesExtra ->> '$.fluxoRetido'
;

-- CLASSIFICACAO_RACIAL_RENDA_SEXO: 4 medida(s), 4 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_classificacao_racial_renda_sexo` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.corRaca' AS `corRaca`,
  f.dimensoesExtra ->> '$.rendaFamiliar' AS `rendaFamiliar`,
  f.dimensoesExtra ->> '$.faixaEtaria' AS `faixaEtaria`,
  f.dimensoesExtra ->> '$.sexo' AS `sexo`,
  MAX(CASE WHEN f.medida = 'Número de concluintes' THEN f.valor END) AS `numeroConcluintes`,
  MAX(CASE WHEN f.medida = 'Número de ingressantes' THEN f.valor END) AS `numeroIngressantes`,
  MAX(CASE WHEN f.medida = 'Número de Matrículas' THEN f.valor END) AS `numeroMatriculas`,
  MAX(CASE WHEN f.medida = 'Número de vagas' THEN f.valor END) AS `numeroVagas`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'CLASSIFICACAO_RACIAL_RENDA_SEXO'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.corRaca',
  f.dimensoesExtra ->> '$.rendaFamiliar',
  f.dimensoesExtra ->> '$.faixaEtaria',
  f.dimensoesExtra ->> '$.sexo'
;

-- PERCENTUAIS_LEGAIS: 4 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_percentuais_legais` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Matrícula Equivalente | Formação de Professores' THEN f.valor END) AS `mateqFormacaoProfessores`,
  MAX(CASE WHEN f.medida = 'Matrícula Equivalente | Técnicos' THEN f.valor END) AS `mateqTecnicos`,
  MAX(CASE WHEN f.medida = 'Matrícula Equivalente | Proeja' THEN f.valor END) AS `mateqProeja`,
  MAX(CASE WHEN f.medida = 'Matrícula Equivalente | Geral' THEN f.valor END) AS `mateqGeral`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'PERCENTUAIS_LEGAIS'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- RESERVA_VAGAS: 2 medida(s), 1 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_reserva_vagas` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.tipoReservaVaga' AS `tipoReservaVaga`,
  MAX(CASE WHEN f.medida = 'Vagas Regulares' THEN f.valor END) AS `vagasRegulares`,
  MAX(CASE WHEN f.medida = 'Vagas Regulares %' THEN f.valor END) AS `vagasRegularesPercentual`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'RESERVA_VAGAS'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.tipoReservaVaga'
;

-- OFERTA_VAGAS_NOTURNAS: 3 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_oferta_vagas_noturnas` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Oferta de Vagas | Curso Noturno' THEN f.valor END) AS `ofertaVagasCursoNoturno`,
  MAX(CASE WHEN f.medida = 'Oferta de Vagas | Curso Noturno %' THEN f.valor END) AS `ofertaVagasCursoNoturnoPercentual`,
  MAX(CASE WHEN f.medida = 'Oferta de Vagas | Graduação' THEN f.valor END) AS `ofertaVagasGraduacao`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'OFERTA_VAGAS_NOTURNAS'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- RELACAO_INSCRITOS_VAGAS: 3 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_relacao_inscritos_vagas` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Número de inscritos' THEN f.valor END) AS `numeroInscritos`,
  MAX(CASE WHEN f.medida = 'Número de vagas' THEN f.valor END) AS `numeroVagas`,
  MAX(CASE WHEN f.medida = 'Relação Inscrito Vaga' THEN f.valor END) AS `relacaoInscritoVaga`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'RELACAO_INSCRITOS_VAGAS'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- TAXA_EVASAO: 3 medida(s), 8 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_taxa_evasao` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.nomeCurso' AS `nomeCurso`,
  f.dimensoesExtra ->> '$.tipoCurso' AS `tipoCurso`,
  f.dimensoesExtra ->> '$.tipoEixoTecnologico' AS `tipoEixoTecnologico`,
  f.dimensoesExtra ->> '$.subeixoTecnologico' AS `subeixoTecnologico`,
  f.dimensoesExtra ->> '$.tipoOferta' AS `tipoOferta`,
  f.dimensoesExtra ->> '$.turnoCurso' AS `turnoCurso`,
  f.dimensoesExtra ->> '$.modalidadeEnsino' AS `modalidadeEnsino`,
  f.dimensoesExtra ->> '$.nomeFonteFinanciamento' AS `nomeFonteFinanciamento`,
  MAX(CASE WHEN f.medida = 'Número de Matrículas' THEN f.valor END) AS `numeroMatriculas`,
  MAX(CASE WHEN f.medida = 'Matrículas | Número de Evadidos' THEN f.valor END) AS `numeroEvadidos`,
  MAX(CASE WHEN f.medida = 'Matrículas | Taxa de Evasão %' THEN f.valor END) AS `taxaEvasaoPercentual`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'TAXA_EVASAO'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.nomeCurso',
  f.dimensoesExtra ->> '$.tipoCurso',
  f.dimensoesExtra ->> '$.tipoEixoTecnologico',
  f.dimensoesExtra ->> '$.subeixoTecnologico',
  f.dimensoesExtra ->> '$.tipoOferta',
  f.dimensoesExtra ->> '$.turnoCurso',
  f.dimensoesExtra ->> '$.modalidadeEnsino',
  f.dimensoesExtra ->> '$.nomeFonteFinanciamento'
;

-- EFICIENCIA_ACADEMICA: 7 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_eficiencia_academica` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Eficiência Acadêmica | Concluídos' THEN f.valor END) AS `concluidos`,
  MAX(CASE WHEN f.medida = 'Eficiência Acadêmica | Concluídos %' THEN f.valor END) AS `concluidosPercentual`,
  MAX(CASE WHEN f.medida = 'Eficiência Acadêmica | Índice de Eficiência Acadêmica %' THEN f.valor END) AS `indiceEficienciaAcademicaPercentual`,
  MAX(CASE WHEN f.medida = 'Eficiência Acadêmica | Número de Evadidos' THEN f.valor END) AS `numeroEvadidos`,
  MAX(CASE WHEN f.medida = 'Eficiência Acadêmica | Retidos' THEN f.valor END) AS `retidos`,
  MAX(CASE WHEN f.medida = 'Eficiência Acadêmica | Retidos %' THEN f.valor END) AS `retidosPercentual`,
  MAX(CASE WHEN f.medida = 'Eficiência Acadêmica | Taxa de Evasão %' THEN f.valor END) AS `taxaEvasaoPercentual`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'EFICIENCIA_ACADEMICA'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- RELACAO_ALUNO_PROFESSOR_RAP: 3 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_relacao_aluno_professor_rap` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'RAP | RAP' THEN f.valor END) AS `rap`,
  MAX(CASE WHEN f.medida = 'RAP | Matrículas RAP' THEN f.valor END) AS `matriculasRap`,
  MAX(CASE WHEN f.medida = 'RAP | Professor Equivalente' THEN f.valor END) AS `professorEquivalente`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'RELACAO_ALUNO_PROFESSOR_RAP'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- INDICE_VERTICALIZACAO: 5 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_indice_verticalizacao` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Índice de Verticalização | Vagas - CG' THEN f.valor END) AS `vagasCg`,
  MAX(CASE WHEN f.medida = 'Índice de Verticalização | Vagas - CT' THEN f.valor END) AS `vagasCt`,
  MAX(CASE WHEN f.medida = 'Índice de Verticalização | Vagas - PG' THEN f.valor END) AS `vagasPg`,
  MAX(CASE WHEN f.medida = 'Índice de Verticalização | Vagas - QP' THEN f.valor END) AS `vagasQp`,
  MAX(CASE WHEN f.medida = 'Índice de Verticalização | Eixo Tecnológico' THEN f.valor END) AS `eixoTecnologico`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'INDICE_VERTICALIZACAO'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- TAXA_OCUPACAO: 3 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_taxa_ocupacao` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Taxa de Ocupação | Matriculas Ciclos Vigentes' THEN f.valor END) AS `matriculasCiclosVigentes`,
  MAX(CASE WHEN f.medida = 'Taxa de Ocupação | Vagas Ciclos Vigentes' THEN f.valor END) AS `vagasCiclosVigentes`,
  MAX(CASE WHEN f.medida = 'Taxa de Ocupação | Taxa de Ocupação' THEN f.valor END) AS `taxaOcupacaoPercentual`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'TAXA_OCUPACAO'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- PROFESSORES_POR_INSTITUICAO: 1 medida(s), 2 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_professores_por_instituicao` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.titulacao' AS `titulacao`,
  f.dimensoesExtra ->> '$.jornadaDeTrabalho' AS `jornadaDeTrabalho`,
  MAX(CASE WHEN f.medida = 'Servidores | Número de Docentes' THEN f.valor END) AS `numeroDocentes`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'PROFESSORES_POR_INSTITUICAO'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.titulacao',
  f.dimensoesExtra ->> '$.jornadaDeTrabalho'
;

-- TECNICOS_ADM_NIVEL: 1 medida(s), 1 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_tecnicos_adm_nivel` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.titulacao' AS `titulacao`,
  MAX(CASE WHEN f.medida = 'Servidores | Número de TAE' THEN f.valor END) AS `numeroTae`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'TECNICOS_ADM_NIVEL'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.titulacao'
;

-- TITULACAO_DOCENTE: 4 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_titulacao_docente` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Servidores | Docente Efetivo' THEN f.valor END) AS `docenteEfetivo`,
  MAX(CASE WHEN f.medida = 'Servidores | Número de Docentes' THEN f.valor END) AS `numeroDocentes`,
  MAX(CASE WHEN f.medida = 'Servidores | Número de Servidores' THEN f.valor END) AS `numeroServidores`,
  MAX(CASE WHEN f.medida = 'Servidores | ITCD' THEN f.valor END) AS `itcd`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'TITULACAO_DOCENTE'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- INDICADORES_GASTOS: 8 medida(s), 0 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_indicadores_gastos` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  MAX(CASE WHEN f.medida = 'Gastos Correntes por matrícula equivalente' THEN f.valor END) AS `gastosPorMatriculaEquivalente`,
  MAX(CASE WHEN f.medida = 'Gastos Correntes | Gastos Totais' THEN f.valor END) AS `gastosTotais`,
  MAX(CASE WHEN f.medida = 'Gastos Correntes | Gastos Correntes' THEN f.valor END) AS `gastosCorrentes`,
  MAX(CASE WHEN f.medida = 'Gastos Correntes | Inativos e Pensionistas' THEN f.valor END) AS `inativosPensionistas`,
  MAX(CASE WHEN f.medida = 'Gastos Correntes | Investimentos e Inversões Financeiras' THEN f.valor END) AS `investimentosInversoesFinanceiras`,
  MAX(CASE WHEN f.medida = 'Gastos Correntes | Precatórios' THEN f.valor END) AS `precatorios`,
  MAX(CASE WHEN f.medida = 'Gastos Correntes | Outros Custeios' THEN f.valor END) AS `outrosCusteios`,
  MAX(CASE WHEN f.medida = 'Gastos Correntes | Pessoal' THEN f.valor END) AS `pessoal`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'INDICADORES_GASTOS'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome
;

-- PANORAMA_ORCAMENTARIO: 7 medida(s), 2 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_panorama_orcamentario` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.relacaoOrgao' AS `relacaoOrgao`,
  f.dimensoesExtra ->> '$.resultadoPrimario' AS `resultadoPrimario`,
  MAX(CASE WHEN f.medida = 'Dotação atualizada' THEN f.valor END) AS `dotacaoAtualizada`,
  MAX(CASE WHEN f.medida = 'Despesa empenhada' THEN f.valor END) AS `despesaEmpenhada`,
  MAX(CASE WHEN f.medida = 'Despesa liquidada' THEN f.valor END) AS `despesaLiquidada`,
  MAX(CASE WHEN f.medida = 'Despesa paga' THEN f.valor END) AS `despesaPaga`,
  MAX(CASE WHEN f.medida = 'Despesa liq&RP' THEN f.valor END) AS `despesaLiqRp`,
  MAX(CASE WHEN f.medida = 'Despesa empenhada a liquidar' THEN f.valor END) AS `despesaEmpenhadaALiquidar`,
  MAX(CASE WHEN f.medida = 'Crédito Disponível' THEN f.valor END) AS `creditoDisponivel`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'PANORAMA_ORCAMENTARIO'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.relacaoOrgao',
  f.dimensoesExtra ->> '$.resultadoPrimario'
;

-- CARGOS_CARREIRA: 1 medida(s), 1 dimensão(ões) extra além de ano/instituição/câmpus.
CREATE OR REPLACE VIEW `vw_cargos_carreira` AS
SELECT
  f.ano AS ano,
  i.sigla AS instituicaoSigla,
  i.nome AS instituicaoNome,
  f.instituicaoId AS instituicaoId,
  u.nome AS unidadeNome,
  f.unidadeId AS unidadeId,
  f.dimensoesExtra ->> '$.carreiraSigla' AS `carreiraSigla`,
  MAX(CASE WHEN f.medida = 'Número de servidores (Siafi)' THEN f.valor END) AS `numeroServidoresSiafi`
FROM FatoIndicador f
JOIN Instituicao i ON i.id = f.instituicaoId
LEFT JOIN Unidade u ON u.id = f.unidadeId
WHERE f.fileType = 'CARGOS_CARREIRA'
GROUP BY
  f.ano,
  f.instituicaoId,
  i.sigla,
  i.nome,
  f.unidadeId,
  u.nome,
  f.dimensoesExtra ->> '$.carreiraSigla'
;
