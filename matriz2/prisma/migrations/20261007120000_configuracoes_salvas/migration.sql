-- CreateTable
CREATE TABLE `ConfiguracaoSalva` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `donoId` INTEGER NOT NULL,
    `tela` VARCHAR(160) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `dados` JSON NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,
    `atualizadoPorId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `ConfiguracaoSalva_tela_donoId_idx`(`tela`, `donoId`),
    UNIQUE INDEX `ConfiguracaoSalva_donoId_tela_nome_key`(`donoId`, `tela`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConfiguracaoCompartilhada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `configuracaoId` INTEGER NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConfiguracaoCompartilhada_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `ConfiguracaoCompartilhada_configuracaoId_usuarioId_key`(`configuracaoId`, `usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConfiguracaoSalva` ADD CONSTRAINT `ConfiguracaoSalva_donoId_fkey` FOREIGN KEY (`donoId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConfiguracaoSalva` ADD CONSTRAINT `ConfiguracaoSalva_atualizadoPorId_fkey` FOREIGN KEY (`atualizadoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConfiguracaoCompartilhada` ADD CONSTRAINT `ConfiguracaoCompartilhada_configuracaoId_fkey` FOREIGN KEY (`configuracaoId`) REFERENCES `ConfiguracaoSalva`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConfiguracaoCompartilhada` ADD CONSTRAINT `ConfiguracaoCompartilhada_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

