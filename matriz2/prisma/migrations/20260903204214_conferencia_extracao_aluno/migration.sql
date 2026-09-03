-- CreateTable
CREATE TABLE `ConferenciaExtracaoAluno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `unidadeId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `codigoCiclo` VARCHAR(191) NOT NULL,
    `nomeCiclo` TEXT NOT NULL,
    `financiamento` VARCHAR(191) NOT NULL,
    `tipoCurso` VARCHAR(191) NOT NULL,
    `curso` VARCHAR(191) NOT NULL,
    `areaEixo` VARCHAR(191) NULL,
    `agropecuaria` BOOLEAN NOT NULL DEFAULT false,
    `tipoOferta` VARCHAR(191) NULL,
    `inicio` DATETIME(3) NULL,
    `previstoTermino` DATETIME(3) NULL,
    `jubilamento` DATETIME(3) NULL,
    `chHoraria` INTEGER NULL,
    `chHorariaMec` INTEGER NULL,
    `chMatriz` INTEGER NULL,
    `matriculaAluno` VARCHAR(191) NOT NULL,
    `renda` VARCHAR(191) NULL,
    `situacaoMatricula` VARCHAR(191) NULL,
    `situacaoMatriz` VARCHAR(191) NULL,

    INDEX `ConferenciaExtracaoAluno_ano_unidadeId_idx`(`ano`, `unidadeId`),
    INDEX `ConferenciaExtracaoAluno_fonteDadosId_idx`(`fonteDadosId`),
    INDEX `ConferenciaExtracaoAluno_matriculaAluno_idx`(`matriculaAluno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConferenciaExtracaoAluno` ADD CONSTRAINT `ConferenciaExtracaoAluno_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConferenciaExtracaoAluno` ADD CONSTRAINT `ConferenciaExtracaoAluno_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
