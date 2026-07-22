-- CreateTable
CREATE TABLE `Autarquia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sigla` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Autarquia_sigla_key`(`sigla`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigoPnp` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `autarquiaId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Campus_codigoPnp_key`(`codigoPnp`),
    INDEX `Campus_autarquiaId_idx`(`autarquiaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Curso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campusId` INTEGER NOT NULL,
    `codigoPnp` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `eixoTecnologico` ENUM('RECURSOS_NATURAIS', 'PRODUCAO_INDUSTRIAL', 'INFORMACAO_COMUNICACAO', 'GESTAO_NEGOCIOS', 'AMBIENTE_SAUDE', 'PRODUCAO_ALIMENTOS', 'INFRAESTRUTURA', 'MILITAR', 'CONTROLE_PROCESSOS_INDUSTRIAIS', 'DESENVOLVIMENTO_EDUCACIONAL_SOCIAL', 'PRODUCAO_CULTURAL_DESIGN', 'SEGURANCA', 'TURISMO_HOSPITALIDADE_LAZER', 'OUTRO') NOT NULL,
    `nivel` ENUM('TECNICO_INTEGRADO', 'TECNICO_CONCOMITANTE', 'TECNICO_SUBSEQUENTE', 'GRADUACAO', 'ESPECIALIZACAO', 'MESTRADO', 'DOUTORADO') NOT NULL,
    `modalidade` ENUM('PRESENCIAL', 'EAD_PROPRIO', 'EAD_FOMENTO_EXTERNO') NOT NULL,
    `cnctLabTier` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Curso_campusId_idx`(`campusId`),
    UNIQUE INDEX `Curso_campusId_codigoPnp_key`(`campusId`, `codigoPnp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IngestionBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('PENDING', 'VALIDATING', 'VALIDATED_WITH_WARNINGS', 'FAILED_VALIDATION', 'PERSISTED') NOT NULL DEFAULT 'PENDING',
    `uploadedByEmail` VARCHAR(191) NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `fileType` ENUM('DADOS_GERAIS', 'EFICIENCIA_ACADEMICA', 'RELACAO_ALUNO_PROFESSOR_RAP', 'PERCENTUAIS_LEGAIS', 'CLASSIFICACAO_RACIAL_RENDA_SEXO', 'SITUACAO_MATRICULA') NOT NULL,
    `detectedEncoding` VARCHAR(191) NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `rowCount` INTEGER NULL,
    `validationReport` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `IngestionBatch_fileType_status_idx`(`fileType`, `status`),
    INDEX `IngestionBatch_checksum_idx`(`checksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Matricula` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cursoId` INTEGER NOT NULL,
    `ingestionBatchId` INTEGER NOT NULL,
    `matriculaEquivalente` DECIMAL(12, 4) NOT NULL,
    `situacao` VARCHAR(191) NOT NULL,
    `dataIngressoCiclo` DATETIME(3) NULL,
    `dataReferencia` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Matricula_cursoId_idx`(`cursoId`),
    INDEX `Matricula_ingestionBatchId_idx`(`ingestionBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndicadorCampus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campusId` INTEGER NOT NULL,
    `ingestionBatchId` INTEGER NOT NULL,
    `tipo` ENUM('IEA', 'RAP', 'IAPL_TECNICOS', 'IAPL_FORMACAO_PROFESSORES', 'IAPL_PROEJA') NOT NULL,
    `valor` DECIMAL(12, 6) NOT NULL,
    `regimeTrabalho` VARCHAR(191) NULL,
    `referenciaAno` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IndicadorCampus_campusId_tipo_referenciaAno_idx`(`campusId`, `tipo`, `referenciaAno`),
    INDEX `IndicadorCampus_ingestionBatchId_idx`(`ingestionBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalculationRun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'RUNNING',
    `ingestionBatchIds` JSON NOT NULL,
    `parametersSnapshot` JSON NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,

    INDEX `CalculationRun_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalculationResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `runId` INTEGER NOT NULL,
    `campusId` INTEGER NULL,
    `cursoId` INTEGER NULL,
    `bloco` ENUM('FUNCIONAMENTO', 'REITORIAS', 'QUALIDADE_EFICIENCIA') NOT NULL,
    `metrica` VARCHAR(191) NOT NULL,
    `valor` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CalculationResult_runId_bloco_idx`(`runId`, `bloco`),
    INDEX `CalculationResult_campusId_idx`(`campusId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Campus` ADD CONSTRAINT `Campus_autarquiaId_fkey` FOREIGN KEY (`autarquiaId`) REFERENCES `Autarquia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Curso` ADD CONSTRAINT `Curso_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Matricula` ADD CONSTRAINT `Matricula_cursoId_fkey` FOREIGN KEY (`cursoId`) REFERENCES `Curso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Matricula` ADD CONSTRAINT `Matricula_ingestionBatchId_fkey` FOREIGN KEY (`ingestionBatchId`) REFERENCES `IngestionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicadorCampus` ADD CONSTRAINT `IndicadorCampus_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicadorCampus` ADD CONSTRAINT `IndicadorCampus_ingestionBatchId_fkey` FOREIGN KEY (`ingestionBatchId`) REFERENCES `IngestionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalculationResult` ADD CONSTRAINT `CalculationResult_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `CalculationRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
