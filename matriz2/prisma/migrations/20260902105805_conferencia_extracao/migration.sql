-- CreateTable
CREATE TABLE `ConferenciaExtracao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `unidadeId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `concluido` DECIMAL(18, 4) NULL,
    `integralizado` DECIMAL(18, 4) NULL,
    `emCurso` DECIMAL(18, 4) NULL,
    `retido` DECIMAL(18, 4) NULL,
    `matriz` DECIMAL(18, 4) NULL,
    `abandono` DECIMAL(18, 4) NULL,
    `desligado` DECIMAL(18, 4) NULL,
    `reprovado` DECIMAL(18, 4) NULL,
    `transfExterna` DECIMAL(18, 4) NULL,
    `transfInterna` DECIMAL(18, 4) NULL,
    `rendaNaoDeclarada` DECIMAL(18, 4) NULL,
    `rendaAte05` DECIMAL(18, 4) NULL,
    `renda05a10` DECIMAL(18, 4) NULL,
    `renda10a15` DECIMAL(18, 4) NULL,
    `renda15a25` DECIMAL(18, 4) NULL,
    `renda25a35` DECIMAL(18, 4) NULL,
    `rendaAcima35` DECIMAL(18, 4) NULL,
    `rendaTotal` DECIMAL(18, 4) NULL,
    `rendaPonderada` DECIMAL(18, 6) NULL,

    INDEX `ConferenciaExtracao_ano_idx`(`ano`),
    INDEX `ConferenciaExtracao_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `ConferenciaExtracao_ano_unidadeId_key`(`ano`, `unidadeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConferenciaExtracao` ADD CONSTRAINT `ConferenciaExtracao_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConferenciaExtracao` ADD CONSTRAINT `ConferenciaExtracao_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
