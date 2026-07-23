-- AlterTable
ALTER TABLE `CalculationResult` ADD COLUMN `detalhe` JSON NULL;

-- AlterTable
ALTER TABLE `CalculationRun` ADD COLUMN `origem` ENUM('SIMULACAO', 'OFICIAL') NOT NULL DEFAULT 'SIMULACAO';

-- CreateTable
CREATE TABLE `OrcamentoAnual` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `valorTotal` DECIMAL(18, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OrcamentoAnual_ano_key`(`ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CalculationRun_origem_idx` ON `CalculationRun`(`origem`);
