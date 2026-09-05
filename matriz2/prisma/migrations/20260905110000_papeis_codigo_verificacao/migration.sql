-- Escrita à mão (não gerada por `prisma migrate dev`): o ambiente não tem terminal
-- interativo, e o Prisma recusa aplicar sozinho uma migração que apaga uma coluna
-- com dado (`superAdmin`, com 1 linha não nula) fora de um terminal interativo.
-- A migração abaixo faz a mesma coisa que o Prisma geraria, mas com um passo a mais
-- no meio: guarda o valor de `superAdmin` em `papel` ANTES de apagar a coluna, para
-- não rebaixar quem já era super-admin (ou admin comum) para o papel padrão.

-- AlterTable
ALTER TABLE `Usuario`
    ADD COLUMN `papel` ENUM('SUPER_ADMIN', 'ADMIN', 'PADRAO') NOT NULL DEFAULT 'PADRAO';

-- Preserva o papel de quem já tinha conta: superAdmin=1 vira SUPER_ADMIN, e todo o
-- resto (que hoje só existe como "admin comum", nunca como o novo papel PADRAO)
-- vira ADMIN. Só cadastro NOVO, a partir de agora, pode nascer PADRAO.
UPDATE `Usuario` SET `papel` = IF(`superAdmin` = 1, 'SUPER_ADMIN', 'ADMIN');

-- AlterTable
ALTER TABLE `Usuario`
    MODIFY COLUMN `senhaHash` VARCHAR(191) NULL,
    MODIFY COLUMN `precisaTrocarSenha` BOOLEAN NOT NULL DEFAULT false,
    DROP COLUMN `superAdmin`;

-- CreateTable
CREATE TABLE `CodigoVerificacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `tipo` ENUM('PRIMEIRO_ACESSO', 'RECUPERACAO_SENHA') NOT NULL,
    `codigoHash` CHAR(64) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiraEm` DATETIME(3) NOT NULL,
    `usadoEm` DATETIME(3) NULL,

    INDEX `CodigoVerificacao_usuarioId_idx`(`usuarioId`),
    INDEX `CodigoVerificacao_expiraEm_idx`(`expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CodigoVerificacao` ADD CONSTRAINT `CodigoVerificacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
