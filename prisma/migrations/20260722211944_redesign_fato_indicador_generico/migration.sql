-- DropForeignKey
ALTER TABLE `Campus` DROP FOREIGN KEY `Campus_autarquiaId_fkey`;

-- DropForeignKey
ALTER TABLE `Curso` DROP FOREIGN KEY `Curso_campusId_fkey`;

-- DropForeignKey
ALTER TABLE `IndicadorCampus` DROP FOREIGN KEY `IndicadorCampus_campusId_fkey`;

-- DropForeignKey
ALTER TABLE `IndicadorCampus` DROP FOREIGN KEY `IndicadorCampus_ingestionBatchId_fkey`;

-- DropForeignKey
ALTER TABLE `Matricula` DROP FOREIGN KEY `Matricula_cursoId_fkey`;

-- DropForeignKey
ALTER TABLE `Matricula` DROP FOREIGN KEY `Matricula_ingestionBatchId_fkey`;

-- AlterTable
ALTER TABLE `IngestionBatch` MODIFY `fileType` ENUM('DADOS_GERAIS', 'SITUACAO_MATRICULA', 'CLASSIFICACAO_RACIAL_RENDA_SEXO', 'PERCENTUAIS_LEGAIS', 'RESERVA_VAGAS', 'OFERTA_VAGAS_NOTURNAS', 'RELACAO_INSCRITOS_VAGAS', 'TAXA_EVASAO', 'EFICIENCIA_ACADEMICA', 'RELACAO_ALUNO_PROFESSOR_RAP', 'INDICE_VERTICALIZACAO', 'TAXA_OCUPACAO', 'PROFESSORES_POR_INSTITUICAO', 'TECNICOS_ADM_NIVEL', 'TITULACAO_DOCENTE', 'INDICADORES_GASTOS', 'PANORAMA_ORCAMENTARIO', 'CARGOS_CARREIRA') NOT NULL;

-- DropTable
DROP TABLE `Autarquia`;

-- DropTable
DROP TABLE `Campus`;

-- DropTable
DROP TABLE `Curso`;

-- DropTable
DROP TABLE `IndicadorCampus`;

-- DropTable
DROP TABLE `Matricula`;

-- CreateTable
CREATE TABLE `Instituicao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sigla` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `organizacaoAcademica` VARCHAR(191) NOT NULL,
    `regiao` VARCHAR(191) NOT NULL,
    `uf` VARCHAR(191) NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Instituicao_sigla_key`(`sigla`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unidade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `instituicaoId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Unidade_instituicaoId_idx`(`instituicaoId`),
    UNIQUE INDEX `Unidade_instituicaoId_nome_key`(`instituicaoId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FatoIndicador` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ingestionBatchId` INTEGER NOT NULL,
    `fileType` ENUM('DADOS_GERAIS', 'SITUACAO_MATRICULA', 'CLASSIFICACAO_RACIAL_RENDA_SEXO', 'PERCENTUAIS_LEGAIS', 'RESERVA_VAGAS', 'OFERTA_VAGAS_NOTURNAS', 'RELACAO_INSCRITOS_VAGAS', 'TAXA_EVASAO', 'EFICIENCIA_ACADEMICA', 'RELACAO_ALUNO_PROFESSOR_RAP', 'INDICE_VERTICALIZACAO', 'TAXA_OCUPACAO', 'PROFESSORES_POR_INSTITUICAO', 'TECNICOS_ADM_NIVEL', 'TITULACAO_DOCENTE', 'INDICADORES_GASTOS', 'PANORAMA_ORCAMENTARIO', 'CARGOS_CARREIRA') NOT NULL,
    `ano` INTEGER NOT NULL,
    `instituicaoId` INTEGER NOT NULL,
    `unidadeId` INTEGER NULL,
    `dimensoesExtra` JSON NULL,
    `medida` VARCHAR(191) NOT NULL,
    `valor` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FatoIndicador_fileType_medida_ano_idx`(`fileType`, `medida`, `ano`),
    INDEX `FatoIndicador_unidadeId_idx`(`unidadeId`),
    INDEX `FatoIndicador_instituicaoId_idx`(`instituicaoId`),
    INDEX `FatoIndicador_ingestionBatchId_idx`(`ingestionBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Unidade` ADD CONSTRAINT `Unidade_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FatoIndicador` ADD CONSTRAINT `FatoIndicador_ingestionBatchId_fkey` FOREIGN KEY (`ingestionBatchId`) REFERENCES `IngestionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FatoIndicador` ADD CONSTRAINT `FatoIndicador_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FatoIndicador` ADD CONSTRAINT `FatoIndicador_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

