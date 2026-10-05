-- CreateTable
CREATE TABLE `ExecucaoDespesaUg` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `unidadeId` INTEGER NULL,
    `ugCodigo` VARCHAR(10) NOT NULL,
    `ugNome` VARCHAR(120) NOT NULL,
    `ano` INTEGER NOT NULL,
    `mes` INTEGER NOT NULL,
    `acao` VARCHAR(10) NOT NULL,
    `empenhado` DECIMAL(18, 2) NOT NULL,
    `liquidado` DECIMAL(18, 2) NOT NULL,
    `pago` DECIMAL(18, 2) NOT NULL,
    `fonte` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ExecucaoDespesaUg_instituicaoId_ano_acao_idx`(`instituicaoId`, `ano`, `acao`),
    UNIQUE INDEX `ExecucaoDespesaUg_instituicaoId_ugCodigo_ano_mes_acao_key`(`instituicaoId`, `ugCodigo`, `ano`, `mes`, `acao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrcamentoDespesaAcao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `exercicio` INTEGER NOT NULL,
    `acao` VARCHAR(10) NOT NULL,
    `acaoDescricao` VARCHAR(255) NOT NULL,
    `inicial` DECIMAL(18, 2) NOT NULL,
    `atualizado` DECIMAL(18, 2) NOT NULL,
    `empenhado` DECIMAL(18, 2) NOT NULL,
    `realizado` DECIMAL(18, 2) NOT NULL,
    `fonte` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OrcamentoDespesaAcao_instituicaoId_exercicio_acao_key`(`instituicaoId`, `exercicio`, `acao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExecucaoDespesaUg` ADD CONSTRAINT `ExecucaoDespesaUg_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExecucaoDespesaUg` ADD CONSTRAINT `ExecucaoDespesaUg_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrcamentoDespesaAcao` ADD CONSTRAINT `OrcamentoDespesaAcao_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

