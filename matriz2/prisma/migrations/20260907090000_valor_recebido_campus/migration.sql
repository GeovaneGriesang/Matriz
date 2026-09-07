-- Escrita à mão (não gerada por `prisma migrate dev`): o schema engine do Prisma
-- falhou ao subir localmente ("Error in Schema engine: Starting schema engine RPC
-- server") nesta sessão. A tabela é puramente aditiva (CREATE TABLE + FKs), sem
-- nenhuma coluna existente alterada, então escrever a mão tem o mesmo resultado
-- que `prisma migrate dev` geraria.

-- CreateTable
CREATE TABLE `ValorRecebidoCampus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `unidadeId` INTEGER NOT NULL,
    `valorRecebido` DECIMAL(18, 6) NOT NULL,
    `observacao` TEXT NULL,
    `registradoPorId` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    INDEX `ValorRecebidoCampus_ano_idx`(`ano`),
    UNIQUE INDEX `ValorRecebidoCampus_ano_unidadeId_key`(`ano`, `unidadeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ValorRecebidoCampus` ADD CONSTRAINT `ValorRecebidoCampus_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValorRecebidoCampus` ADD CONSTRAINT `ValorRecebidoCampus_registradoPorId_fkey` FOREIGN KEY (`registradoPorId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
