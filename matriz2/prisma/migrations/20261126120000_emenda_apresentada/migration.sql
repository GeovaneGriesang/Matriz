-- CreateTable
CREATE TABLE `EmendaApresentada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exercicio` INTEGER NOT NULL,
    `numero` VARCHAR(12) NOT NULL,
    `modalidade` VARCHAR(40) NOT NULL,
    `tipoAutor` VARCHAR(60) NOT NULL,
    `autorCodigo` VARCHAR(10) NOT NULL,
    `autor` VARCHAR(160) NOT NULL,
    `ementa` TEXT NOT NULL,
    `uoCodigo` VARCHAR(10) NOT NULL,
    `uoNome` VARCHAR(255) NOT NULL,
    `instituicaoId` INTEGER NULL,
    `uf` VARCHAR(2) NULL,
    `funcional` VARCHAR(40) NOT NULL,
    `acao` VARCHAR(10) NOT NULL,
    `acaoDescricao` VARCHAR(255) NOT NULL,
    `subtitulo` VARCHAR(255) NOT NULL,
    `localidade` VARCHAR(120) NOT NULL,
    `valorGnd3` DECIMAL(18, 2) NOT NULL,
    `valorGnd4` DECIMAL(18, 2) NOT NULL,
    `valorOutros` DECIMAL(18, 2) NOT NULL,
    `valorTotal` DECIMAL(18, 2) NOT NULL,
    `comRecibo` BOOLEAN NULL,
    `justificativa` TEXT NOT NULL,
    `fonte` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmendaApresentada_exercicio_instituicaoId_idx`(`exercicio`, `instituicaoId`),
    UNIQUE INDEX `EmendaApresentada_exercicio_numero_key`(`exercicio`, `numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EmendaApresentada` ADD CONSTRAINT `EmendaApresentada_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

