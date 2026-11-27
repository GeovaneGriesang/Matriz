-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `unidadeId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ContaSiconfi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ente` VARCHAR(20) NOT NULL,
    `codIbge` INTEGER NOT NULL,
    `exercicio` INTEGER NOT NULL,
    `periodo` INTEGER NOT NULL,
    `anexo` VARCHAR(30) NOT NULL,
    `ordem` INTEGER NOT NULL,
    `codConta` VARCHAR(150) NOT NULL,
    `conta` VARCHAR(300) NOT NULL,
    `nivel` VARCHAR(20) NOT NULL,
    `funcao` VARCHAR(150) NULL,
    `coluna` VARCHAR(30) NOT NULL,
    `valor` DECIMAL(20, 2) NOT NULL,
    `fonte` VARCHAR(300) NOT NULL,

    INDEX `ContaSiconfi_ente_exercicio_anexo_idx`(`ente`, `exercicio`, `anexo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrcamentoEstadualDespesa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exercicio` INTEGER NOT NULL,
    `documento` VARCHAR(10) NOT NULL,
    `orgaoCodigo` INTEGER NOT NULL,
    `orgaoNome` VARCHAR(200) NOT NULL,
    `uoCodigo` INTEGER NOT NULL,
    `uoNome` VARCHAR(200) NOT NULL,
    `funcaoCodigo` INTEGER NOT NULL,
    `funcaoNome` VARCHAR(100) NOT NULL,
    `subfuncaoCodigo` INTEGER NOT NULL,
    `subfuncaoNome` VARCHAR(150) NOT NULL,
    `acaoCodigo` INTEGER NOT NULL,
    `acaoNome` VARCHAR(300) NOT NULL,
    `grupoCodigo` INTEGER NOT NULL,
    `grupoNome` VARCHAR(100) NOT NULL,
    `fonteCodigo` INTEGER NOT NULL,
    `fonteNome` VARCHAR(200) NOT NULL,
    `valor` DECIMAL(18, 2) NOT NULL,
    `fonte` VARCHAR(300) NOT NULL,

    INDEX `OrcamentoEstadualDespesa_exercicio_documento_idx`(`exercicio`, `documento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrcamentoEstadualReceita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exercicio` INTEGER NOT NULL,
    `documento` VARCHAR(10) NOT NULL,
    `orgaoCodigo` INTEGER NOT NULL,
    `orgaoNome` VARCHAR(200) NOT NULL,
    `codigo` VARCHAR(30) NOT NULL,
    `nome` VARCHAR(300) NOT NULL,
    `valor` DECIMAL(18, 2) NOT NULL,
    `fonte` VARCHAR(300) NOT NULL,

    INDEX `OrcamentoEstadualReceita_exercicio_documento_idx`(`exercicio`, `documento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmendaMunicipal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `municipio` VARCHAR(30) NOT NULL,
    `idExterno` INTEGER NOT NULL,
    `exercicio` INTEGER NOT NULL,
    `numero` VARCHAR(20) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `tipoDetalhe` VARCHAR(100) NULL,
    `projetoDeLei` VARCHAR(20) NULL,
    `autoria` VARCHAR(200) NOT NULL,
    `vereador` VARCHAR(200) NULL,
    `partido` VARCHAR(30) NULL,
    `beneficiario` VARCHAR(300) NULL,
    `orgao` VARCHAR(200) NULL,
    `programa` VARCHAR(200) NULL,
    `acao` VARCHAR(300) NULL,
    `fonteRecurso` VARCHAR(200) NULL,
    `valor` DECIMAL(18, 2) NULL,
    `objeto` TEXT NOT NULL,
    `justificativa` TEXT NULL,
    `situacao` VARCHAR(500) NULL,
    `apresentadaEm` DATETIME(3) NULL,
    `citaIfsul` BOOLEAN NOT NULL DEFAULT false,
    `url` VARCHAR(300) NOT NULL,
    `fonte` VARCHAR(300) NOT NULL,

    UNIQUE INDEX `EmendaMunicipal_idExterno_key`(`idExterno`),
    INDEX `EmendaMunicipal_municipio_exercicio_idx`(`municipio`, `exercicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Usuario` ADD CONSTRAINT `Usuario_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

