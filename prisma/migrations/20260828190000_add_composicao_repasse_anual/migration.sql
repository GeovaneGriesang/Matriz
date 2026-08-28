-- CreateTable
CREATE TABLE `ComposicaoRepasseAnual` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `modalidadeEnsino` VARCHAR(60) NOT NULL,
    `fonteFinanciamento` VARCHAR(120) NOT NULL,
    `categoriaRepasse` ENUM('PRESENCIAL', 'EAD', 'EAD_MOOC', 'EAD_FP') NOT NULL,
    `peso` DECIMAL(6, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ComposicaoRepasseAnual_ano_idx`(`ano`),
    UNIQUE INDEX `ComposicaoRepasseAnual_ano_modalidade_fonte_key`(`ano`, `modalidadeEnsino`, `fonteFinanciamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
