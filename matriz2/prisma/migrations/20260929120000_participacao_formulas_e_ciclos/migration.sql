-- AlterTable
ALTER TABLE `DistribuicaoCiclo` ADD COLUMN `agropecuaria` BOOLEAN NULL,
    ADD COLUMN `alunosContabilizados` DECIMAL(18, 5) NULL,
    ADD COLUMN `alunosNaoContabilizados` DECIMAL(18, 5) NULL,
    ADD COLUMN `chExcedente` INTEGER NULL,
    ADD COLUMN `contribuicaoInstituicao` DECIMAL(18, 10) NULL;

-- CreateTable
CREATE TABLE `ParametrosParticipacao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `instituicaoId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `periodoInicio` DATE NOT NULL,
    `periodoFim` DATE NOT NULL,
    `valorOrcamento` DECIMAL(18, 2) NOT NULL,
    `ajuste` DECIMAL(18, 2) NOT NULL,
    `assistenciaEstudantil` DECIMAL(18, 2) NOT NULL,
    `novosCampi` DECIMAL(18, 2) NOT NULL,
    `percentualFuncionamento` DECIMAL(9, 6) NOT NULL,
    `matriculasPresencial` DECIMAL(18, 6) NOT NULL,
    `matriculasEad` DECIMAL(18, 6) NOT NULL,
    `matriculasEadMooc` DECIMAL(18, 6) NOT NULL,
    `matriculasEadFp` DECIMAL(18, 6) NOT NULL,
    `pesoEad` DECIMAL(9, 6) NOT NULL,
    `pesoEadMooc` DECIMAL(9, 6) NOT NULL,
    `pesoEadFp` DECIMAL(9, 6) NOT NULL,
    `valorMatriculaPresencial` DECIMAL(18, 6) NOT NULL,
    `valorMatriculaEad` DECIMAL(18, 6) NOT NULL,
    `valorMatriculaEadMooc` DECIMAL(18, 6) NOT NULL,
    `valorMatriculaEadFp` DECIMAL(18, 6) NOT NULL,

    INDEX `ParametrosParticipacao_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `ParametrosParticipacao_ano_instituicaoId_key`(`ano`, `instituicaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConferenciaCiclo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `unidadeId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `codigoCiclo` VARCHAR(191) NOT NULL,
    `nomeCiclo` TEXT NOT NULL,
    `modalidade` VARCHAR(191) NOT NULL,
    `financiamento` VARCHAR(191) NOT NULL,
    `tipoCurso` VARCHAR(191) NOT NULL,
    `curso` VARCHAR(191) NOT NULL,
    `areaEixo` VARCHAR(191) NULL,
    `agropecuaria` BOOLEAN NOT NULL DEFAULT false,
    `tipoOferta` VARCHAR(191) NULL,
    `inicio` DATETIME(3) NULL,
    `previstoTermino` DATETIME(3) NULL,
    `chHoraria` INTEGER NULL,
    `chHorariaMec` INTEGER NULL,
    `chMatriz` INTEGER NULL,
    `concluida` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `integralizada` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `emFluxo` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `retido` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `abandono` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cancelada` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `desligada` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reprovada` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `substituido` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `transfExterna` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `transfInterna` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `qtdMatriculas` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rendaNaoDeclarada` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rendaAte05` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `renda05a10` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `renda10a15` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `renda15a25` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `renda25a35` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rendaAcima35` DECIMAL(18, 4) NOT NULL DEFAULT 0,

    INDEX `ConferenciaCiclo_ano_unidadeId_idx`(`ano`, `unidadeId`),
    INDEX `ConferenciaCiclo_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `ConferenciaCiclo_ano_unidadeId_codigoCiclo_financiamento_key`(`ano`, `unidadeId`, `codigoCiclo`, `financiamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndicadoresPnpInstituicao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `instituicaoId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `ieaConclusao` DECIMAL(9, 4) NULL,
    `ieaEvasao` DECIMAL(9, 4) NULL,
    `ieaRetencao` DECIMAL(9, 4) NULL,
    `ieaEficiencia` DECIMAL(9, 4) NULL,
    `rapPresencial` DECIMAL(12, 4) NULL,
    `matriculaEqRap` DECIMAL(18, 4) NULL,
    `professorEquivalente` DECIMAL(18, 4) NULL,
    `meTecnicos` DECIMAL(9, 4) NULL,
    `meFormacao` DECIMAL(9, 4) NULL,
    `meProeja` DECIMAL(9, 4) NULL,

    INDEX `IndicadoresPnpInstituicao_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `IndicadoresPnpInstituicao_ano_instituicaoId_key`(`ano`, `instituicaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ParametrosParticipacao` ADD CONSTRAINT `ParametrosParticipacao_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParametrosParticipacao` ADD CONSTRAINT `ParametrosParticipacao_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConferenciaCiclo` ADD CONSTRAINT `ConferenciaCiclo_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConferenciaCiclo` ADD CONSTRAINT `ConferenciaCiclo_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicadoresPnpInstituicao` ADD CONSTRAINT `IndicadoresPnpInstituicao_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IndicadoresPnpInstituicao` ADD CONSTRAINT `IndicadoresPnpInstituicao_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

