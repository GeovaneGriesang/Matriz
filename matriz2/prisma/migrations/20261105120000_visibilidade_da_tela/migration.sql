-- CreateTable
CREATE TABLE `VisibilidadeDaTela` (
    `papel` ENUM('SUPER_ADMIN', 'ADMIN', 'PADRAO') NOT NULL,
    `href` VARCHAR(191) NOT NULL,
    `visivel` BOOLEAN NOT NULL,
    `atualizadoEm` DATETIME(3) NOT NULL,

    PRIMARY KEY (`papel`, `href`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
