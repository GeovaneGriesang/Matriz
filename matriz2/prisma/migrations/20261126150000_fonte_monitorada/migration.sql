-- CreateTable
CREATE TABLE `FonteMonitorada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chave` VARCHAR(80) NOT NULL,
    `nome` VARCHAR(200) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `assunto` VARCHAR(300) NOT NULL,
    `assinatura` VARCHAR(64) NULL,
    `conteudo` LONGTEXT NULL,
    `verificadoEm` DATETIME(3) NULL,
    `mudouEm` DATETIME(3) NULL,
    `erro` VARCHAR(500) NULL,

    UNIQUE INDEX `FonteMonitorada_chave_key`(`chave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificacaoFonte` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fonteId` INTEGER NOT NULL,
    `em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mudou` BOOLEAN NOT NULL,
    `novidades` TEXT NULL,
    `erro` VARCHAR(500) NULL,

    INDEX `VerificacaoFonte_fonteId_em_idx`(`fonteId`, `em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VerificacaoFonte` ADD CONSTRAINT `VerificacaoFonte_fonteId_fkey` FOREIGN KEY (`fonteId`) REFERENCES `FonteMonitorada`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

