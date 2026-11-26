-- AlterTable
ALTER TABLE `Usuario` ADD COLUMN `avisosVistosEm` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `AvisoDoSistema` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo` VARCHAR(20) NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `texto` TEXT NOT NULL,
    `link` VARCHAR(300) NULL,
    `referencia` VARCHAR(80) NULL,
    `emailEnviadoEm` DATETIME(3) NULL,
    `emailErro` VARCHAR(500) NULL,

    INDEX `AvisoDoSistema_criadoEm_idx`(`criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

