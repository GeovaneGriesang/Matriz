-- AlterTable
ALTER TABLE `CalculationResult` MODIFY `bloco` ENUM('FUNCIONAMENTO', 'REITORIAS', 'QUALIDADE_EFICIENCIA', 'ASSISTENCIA_ESTUDANTIL', 'ANUIDADE_CONIF', 'CUSTEIO_OFICIAL', 'ASSISTENCIA_OFICIAL') NOT NULL;

-- CreateTable
CREATE TABLE `CusteioDistribuidoOficial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `ano` INTEGER NOT NULL,
    `custeioOficial` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CusteioDistribuidoOficial_ano_idx`(`ano`),
    UNIQUE INDEX `CusteioDistribuidoOficial_instituicaoId_ano_key`(`instituicaoId`, `ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssistenciaDistribuidoOficial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `ano` INTEGER NOT NULL,
    `assistenciaOficial` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssistenciaDistribuidoOficial_ano_idx`(`ano`),
    UNIQUE INDEX `AssistenciaDistribuidoOficial_instituicaoId_ano_key`(`instituicaoId`, `ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CusteioDistribuidoOficial` ADD CONSTRAINT `CusteioDistribuidoOficial_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssistenciaDistribuidoOficial` ADD CONSTRAINT `AssistenciaDistribuidoOficial_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
