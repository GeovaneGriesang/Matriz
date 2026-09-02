-- CreateTable
CREATE TABLE `ComparativoInstitucional` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `instituicaoId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `matriculas` DECIMAL(18, 6) NULL,
    `iqe` DECIMAL(18, 6) NULL,
    `ae` DECIMAL(18, 6) NULL,
    `totalSpo` DECIMAL(18, 6) NULL,
    `participacaoPercentual` DECIMAL(9, 4) NULL,
    `posicaoRede` INTEGER NULL,

    INDEX `ComparativoInstitucional_ano_idx`(`ano`),
    INDEX `ComparativoInstitucional_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `ComparativoInstitucional_ano_instituicaoId_key`(`ano`, `instituicaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ComparativoInstitucional` ADD CONSTRAINT `ComparativoInstitucional_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComparativoInstitucional` ADD CONSTRAINT `ComparativoInstitucional_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
