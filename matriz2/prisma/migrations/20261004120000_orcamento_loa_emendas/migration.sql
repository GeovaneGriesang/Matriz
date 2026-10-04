-- CreateTable
CREATE TABLE `OrcamentoLoaLinha` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `documento` VARCHAR(10) NOT NULL,
    `exercicio` INTEGER NOT NULL,
    `programa` VARCHAR(10) NOT NULL,
    `acao` VARCHAR(10) NOT NULL,
    `acaoDescricao` VARCHAR(255) NOT NULL,
    `localizador` VARCHAR(10) NOT NULL,
    `gnd` INTEGER NOT NULL,
    `resultadoPrimario` INTEGER NOT NULL,
    `modalidade` INTEGER NOT NULL,
    `fonteRecurso` INTEGER NOT NULL,
    `valor` DECIMAL(18, 2) NOT NULL,
    `produto` VARCHAR(120) NULL,
    `meta` INTEGER NULL,
    `fonte` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrcamentoLoaLinha_instituicaoId_documento_exercicio_acao_idx`(`instituicaoId`, `documento`, `exercicio`, `acao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrcamentoLoaTotal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `documento` VARCHAR(20) NOT NULL,
    `exercicio` INTEGER NOT NULL,
    `valor` DECIMAL(18, 2) NOT NULL,
    `fonte` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OrcamentoLoaTotal_instituicaoId_documento_exercicio_key`(`instituicaoId`, `documento`, `exercicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmendaParlamentar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `exercicio` INTEGER NOT NULL,
    `autor` VARCHAR(120) NOT NULL,
    `numeroEmenda` VARCHAR(20) NOT NULL,
    `acao` VARCHAR(10) NOT NULL,
    `acaoDescricao` VARCHAR(255) NOT NULL,
    `localizador` VARCHAR(120) NOT NULL,
    `beneficiario` VARCHAR(255) NOT NULL,
    `valorAprovado` DECIMAL(18, 2) NOT NULL,
    `valorIndicado` DECIMAL(18, 2) NOT NULL,
    `valorImpedido` DECIMAL(18, 2) NOT NULL,
    `tipoImpedimento` VARCHAR(255) NOT NULL,
    `justificativa` TEXT NULL,
    `fonte` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmendaParlamentar_instituicaoId_exercicio_idx`(`instituicaoId`, `exercicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrcamentoLoaLinha` ADD CONSTRAINT `OrcamentoLoaLinha_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrcamentoLoaTotal` ADD CONSTRAINT `OrcamentoLoaTotal_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmendaParlamentar` ADD CONSTRAINT `EmendaParlamentar_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

