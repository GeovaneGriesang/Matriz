-- CreateTable
CREATE TABLE `PnpOpcaoFiltro` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `painel` VARCHAR(12) NOT NULL,
    `edicao` INTEGER NOT NULL,
    `aba` VARCHAR(60) NOT NULL DEFAULT '',
    `subaba` VARCHAR(80) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `valor` VARCHAR(255) NOT NULL,

    INDEX `PnpOpcaoFiltro_painel_edicao_subaba_tipo_idx`(`painel`, `edicao`, `subaba`, `tipo`),
    UNIQUE INDEX `PnpOpcaoFiltro_painel_edicao_aba_subaba_tipo_valor_key`(`painel`, `edicao`, `aba`, `subaba`, `tipo`, `valor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

