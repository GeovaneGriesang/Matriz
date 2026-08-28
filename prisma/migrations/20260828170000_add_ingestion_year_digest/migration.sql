-- Índice para a importação incremental apagar um ano isolado (WHERE fileType = ? AND ano = ?).
-- O índice existente `FatoIndicador_fileType_medida_ano_idx` não serve: com `medida` no meio,
-- filtrar por fileType+ano pula a coluna do meio e o MySQL cai em varredura completa.
-- CreateIndex
CREATE INDEX `FatoIndicador_fileType_ano_idx` ON `FatoIndicador`(`fileType`, `ano`);

-- CreateTable
CREATE TABLE `IngestionYearDigest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileType` ENUM('DADOS_GERAIS', 'SITUACAO_MATRICULA', 'CLASSIFICACAO_RACIAL_RENDA_SEXO', 'PERCENTUAIS_LEGAIS', 'RESERVA_VAGAS', 'OFERTA_VAGAS_NOTURNAS', 'RELACAO_INSCRITOS_VAGAS', 'TAXA_EVASAO', 'EFICIENCIA_ACADEMICA', 'RELACAO_ALUNO_PROFESSOR_RAP', 'INDICE_VERTICALIZACAO', 'TAXA_OCUPACAO', 'PROFESSORES_POR_INSTITUICAO', 'TECNICOS_ADM_NIVEL', 'TITULACAO_DOCENTE', 'INDICADORES_GASTOS', 'PANORAMA_ORCAMENTARIO', 'CARGOS_CARREIRA') NOT NULL,
    `ano` INTEGER NOT NULL,
    `digest` CHAR(64) NOT NULL,
    `rowCount` INTEGER NOT NULL,
    `factCount` INTEGER NOT NULL,
    `ingestionBatchId` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IngestionYearDigest_ingestionBatchId_idx`(`ingestionBatchId`),
    UNIQUE INDEX `IngestionYearDigest_fileType_ano_key`(`fileType`, `ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IngestionYearDigest` ADD CONSTRAINT `IngestionYearDigest_ingestionBatchId_fkey` FOREIGN KEY (`ingestionBatchId`) REFERENCES `IngestionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
