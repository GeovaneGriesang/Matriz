-- CreateTable
CREATE TABLE `MatriculaTotalEqualizadaAnual` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `unidadeId` INTEGER NOT NULL,
    `ano` INTEGER NOT NULL,
    `matriculaTotalPresencialEqualizada` DECIMAL(18, 5) NOT NULL,
    `matriculaTotalEadEqualizada` DECIMAL(18, 5) NOT NULL,
    `matriculaTotalEadMoocEqualizada` DECIMAL(18, 5) NOT NULL,
    `matriculaTotalEadFpEqualizada` DECIMAL(18, 5) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MatriculaTotalEqualizadaAnual_ano_idx`(`ano`),
    UNIQUE INDEX `MatriculaTotalEqualizadaAnual_unidadeId_ano_key`(`unidadeId`, `ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RappAnual` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `ano` INTEGER NOT NULL,
    `rapp` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RappAnual_ano_idx`(`ano`),
    UNIQUE INDEX `RappAnual_instituicaoId_ano_key`(`instituicaoId`, `ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MatriculaTotalEqualizadaAnual` ADD CONSTRAINT `MatriculaTotalEqualizadaAnual_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RappAnual` ADD CONSTRAINT `RappAnual_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
