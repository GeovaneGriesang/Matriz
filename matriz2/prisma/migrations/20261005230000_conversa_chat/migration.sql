-- CreateTable
CREATE TABLE `ConversaChat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `rota` VARCHAR(120) NOT NULL,
    `pergunta` TEXT NOT NULL,
    `resposta` MEDIUMTEXT NOT NULL,
    `modelo` VARCHAR(60) NOT NULL,
    `duracaoMs` INTEGER NOT NULL,
    `situacao` VARCHAR(20) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConversaChat_usuarioId_criadoEm_idx`(`usuarioId`, `criadoEm`),
    INDEX `ConversaChat_criadoEm_idx`(`criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConversaChat` ADD CONSTRAINT `ConversaChat_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

