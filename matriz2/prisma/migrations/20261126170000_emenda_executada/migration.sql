-- CreateTable
CREATE TABLE `EmendaExecutada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `unidadeId` INTEGER NULL,
    `ano` INTEGER NOT NULL,
    `codigoEmenda` VARCHAR(12) NOT NULL,
    `anoEmenda` INTEGER NOT NULL,
    `numeroNoEspelho` VARCHAR(8) NOT NULL,
    `autor` VARCHAR(200) NOT NULL,
    `ugCodigo` VARCHAR(10) NOT NULL,
    `ugNome` VARCHAR(200) NOT NULL,
    `uoCodigo` VARCHAR(10) NOT NULL,
    `acao` VARCHAR(10) NOT NULL,
    `acaoNome` VARCHAR(300) NOT NULL,
    `gnd` VARCHAR(4) NOT NULL,
    `empenhado` DECIMAL(18, 2) NOT NULL,
    `liquidado` DECIMAL(18, 2) NOT NULL,
    `pago` DECIMAL(18, 2) NOT NULL,
    `rapPago` DECIMAL(18, 2) NOT NULL,
    `fonte` VARCHAR(300) NOT NULL,

    INDEX `EmendaExecutada_instituicaoId_ano_idx`(`instituicaoId`, `ano`),
    INDEX `EmendaExecutada_codigoEmenda_idx`(`codigoEmenda`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmendaExecutada` ADD CONSTRAINT `EmendaExecutada_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmendaExecutada` ADD CONSTRAINT `EmendaExecutada_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

