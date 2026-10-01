-- CreateTable
CREATE TABLE `PesoEfetivoCurso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anoReferencia` INTEGER NOT NULL,
    `tipoCurso` VARCHAR(191) NOT NULL,
    `tipoOferta` VARCHAR(191) NOT NULL,
    `curso` VARCHAR(191) NOT NULL,
    `chMinimaMec` INTEGER NOT NULL,
    `pesoEfetivo` DECIMAL(10, 4) NOT NULL,
    `pesoColuna` DECIMAL(10, 4) NOT NULL,
    `ciclosObservados` INTEGER NOT NULL,
    `ciclosConcordantes` INTEGER NOT NULL,
    `origem` VARCHAR(40) NOT NULL,
    `fonte` TEXT NOT NULL,
    `fonteDadosId` INTEGER NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PesoEfetivoCurso_anoReferencia_tipoCurso_idx`(`anoReferencia`, `tipoCurso`),
    UNIQUE INDEX `PesoEfetivoCurso_anoReferencia_tipoCurso_tipoOferta_curso_ch_key`(`anoReferencia`, `tipoCurso`, `tipoOferta`, `curso`, `chMinimaMec`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PesoEfetivoCurso` ADD CONSTRAINT `PesoEfetivoCurso_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

