-- AlterTable
ALTER TABLE `FonteDados` MODIFY `origem` ENUM('PNP', 'PNP_MANUAL', 'MDO_IFTM', 'CALCULADO', 'ADMINISTRADOR') NOT NULL;

-- CreateTable
CREATE TABLE `PnpEstrutura` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nivel` ENUM('REDE', 'INSTITUICAO', 'CAMPUS') NOT NULL,
    `instituicao` VARCHAR(191) NOT NULL DEFAULT '',
    `organizacaoAcademica` VARCHAR(191) NOT NULL DEFAULT '',
    `regiao` VARCHAR(191) NOT NULL DEFAULT '',
    `estado` VARCHAR(191) NOT NULL DEFAULT '',
    `campus` VARCHAR(191) NOT NULL DEFAULT '',
    `municipio` VARCHAR(191) NOT NULL DEFAULT '',
    `instituicaoId` INTEGER NULL,
    `unidadeId` INTEGER NULL,

    INDEX `PnpEstrutura_instituicaoId_idx`(`instituicaoId`),
    INDEX `PnpEstrutura_unidadeId_idx`(`unidadeId`),
    UNIQUE INDEX `PnpEstrutura_nivel_instituicao_campus_municipio_key`(`nivel`, `instituicao`, `campus`, `municipio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PnpFato` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `estruturaId` INTEGER NOT NULL,
    `aba` VARCHAR(40) NOT NULL,
    `subaba` VARCHAR(80) NOT NULL,
    `dimensao` VARCHAR(80) NOT NULL DEFAULT '',
    `valorDimensao` VARCHAR(255) NOT NULL DEFAULT '',
    `categoria` VARCHAR(255) NOT NULL DEFAULT '',
    `anoBase` SMALLINT NOT NULL,
    `valores` JSON NOT NULL,

    INDEX `PnpFato_subaba_dimensao_anoBase_estruturaId_idx`(`subaba`, `dimensao`, `anoBase`, `estruturaId`),
    INDEX `PnpFato_estruturaId_anoBase_idx`(`estruturaId`, `anoBase`),
    INDEX `PnpFato_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PnpEstrutura` ADD CONSTRAINT `PnpEstrutura_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpEstrutura` ADD CONSTRAINT `PnpEstrutura_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpFato` ADD CONSTRAINT `PnpFato_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpFato` ADD CONSTRAINT `PnpFato_estruturaId_fkey` FOREIGN KEY (`estruturaId`) REFERENCES `PnpEstrutura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

