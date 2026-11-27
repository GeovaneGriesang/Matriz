-- CreateTable
CREATE TABLE `PedidoAcesso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `unidadeId` INTEGER NULL,
    `motivo` VARCHAR(500) NULL,
    `situacao` ENUM('PENDENTE', 'APROVADO', 'RECUSADO') NOT NULL DEFAULT 'PENDENTE',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decididoEm` DATETIME(3) NULL,
    `decididoPorId` INTEGER NULL,

    INDEX `PedidoAcesso_email_idx`(`email`),
    INDEX `PedidoAcesso_situacao_idx`(`situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PedidoAcesso` ADD CONSTRAINT `PedidoAcesso_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PedidoAcesso` ADD CONSTRAINT `PedidoAcesso_decididoPorId_fkey` FOREIGN KEY (`decididoPorId`) REFERENCES `Usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

