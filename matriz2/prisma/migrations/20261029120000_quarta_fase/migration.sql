-- CreateTable
CREATE TABLE `QuartaFaseCiclo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `cicloOrcamento` INTEGER NOT NULL,
    `linha` INTEGER NOT NULL,
    `uf` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `instituicao` VARCHAR(191) NOT NULL,
    `unidade` VARCHAR(191) NOT NULL,
    `modalidade` VARCHAR(191) NOT NULL,
    `financiamento` VARCHAR(191) NOT NULL,
    `tipoCurso` VARCHAR(191) NOT NULL,
    `curso` TEXT NOT NULL,
    `areaEixo` VARCHAR(191) NULL,
    `agropecuaria` BOOLEAN NOT NULL,
    `tipoOferta` VARCHAR(191) NOT NULL,
    `codigoCiclo` VARCHAR(191) NOT NULL,
    `nomeCiclo` TEXT NULL,
    `inicio` DATETIME(3) NOT NULL,
    `termino` DATETIME(3) NOT NULL,
    `chCiclo` INTEGER NOT NULL,
    `chMec` INTEGER NOT NULL,
    `peso` DECIMAL(10, 4) NOT NULL,
    `inicioPeriodo` DATETIME(3) NOT NULL,
    `fimPeriodo` DATETIME(3) NOT NULL,
    `matriculas` DECIMAL(18, 4) NOT NULL,
    `situacao` VARCHAR(191) NOT NULL,
    `resultadosPlanilha` JSON NULL,

    INDEX `QuartaFaseCiclo_fonteDadosId_idx`(`fonteDadosId`),
    INDEX `QuartaFaseCiclo_cicloOrcamento_unidade_idx`(`cicloOrcamento`, `unidade`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuartaFaseUnidade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `cicloOrcamento` INTEGER NOT NULL,
    `linha` INTEGER NOT NULL,
    `unidade` VARCHAR(191) NOT NULL,
    `alunosPresencial` DECIMAL(18, 4) NULL,
    `alunosPresencialFe` DECIMAL(18, 4) NULL,
    `alunosEad` DECIMAL(18, 4) NULL,
    `alunosEadMooc` DECIMAL(18, 4) NULL,
    `alunosEadFp` DECIMAL(18, 4) NULL,
    `alunosTotal` DECIMAL(18, 4) NULL,
    `mtPresencial` DECIMAL(18, 6) NULL,
    `mtEad` DECIMAL(18, 6) NULL,
    `mtEadMooc` DECIMAL(18, 6) NULL,
    `mtEadFp` DECIMAL(18, 6) NULL,

    INDEX `QuartaFaseUnidade_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuartaFaseCiclo` ADD CONSTRAINT `QuartaFaseCiclo_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuartaFaseUnidade` ADD CONSTRAINT `QuartaFaseUnidade_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

