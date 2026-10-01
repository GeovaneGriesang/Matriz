-- AlterTable
ALTER TABLE `PnpEstrutura` MODIFY `nivel` ENUM('REDE', 'REGIAO', 'ESTADO', 'INSTITUICAO', 'CAMPUS') NOT NULL;

-- CreateTable
CREATE TABLE `PnpOrcamentoFato` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `estruturaId` INTEGER NOT NULL,
    `aba` VARCHAR(60) NOT NULL,
    `subaba` VARCHAR(80) NOT NULL,
    `dimensao` VARCHAR(120) NOT NULL DEFAULT '',
    `valorDimensao` VARCHAR(255) NOT NULL DEFAULT '',
    `relacaoOrgao` VARCHAR(40) NOT NULL DEFAULT '',
    `mes` VARCHAR(20) NOT NULL DEFAULT '',
    `tipoValor` VARCHAR(40) NOT NULL DEFAULT '',
    `anoBase` SMALLINT NOT NULL,
    `valores` JSON NOT NULL,

    INDEX `PnpOrcamentoFato_subaba_dimensao_anoBase_estruturaId_idx`(`subaba`, `dimensao`, `anoBase`, `estruturaId`),
    INDEX `PnpOrcamentoFato_estruturaId_anoBase_idx`(`estruturaId`, `anoBase`),
    INDEX `PnpOrcamentoFato_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PnpExtratorFato` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `grupo` VARCHAR(80) NOT NULL,
    `tabela` VARCHAR(80) NOT NULL,
    `anoBase` SMALLINT NOT NULL,
    `instituicao` VARCHAR(60) NOT NULL DEFAULT '',
    `unidade` VARCHAR(191) NOT NULL DEFAULT '',
    `instituicaoId` INTEGER NULL,
    `unidadeId` INTEGER NULL,
    `dimensoes` JSON NOT NULL,
    `valores` JSON NOT NULL,

    INDEX `PnpExtratorFato_tabela_anoBase_instituicao_idx`(`tabela`, `anoBase`, `instituicao`),
    INDEX `PnpExtratorFato_instituicaoId_anoBase_idx`(`instituicaoId`, `anoBase`),
    INDEX `PnpExtratorFato_unidadeId_anoBase_idx`(`unidadeId`, `anoBase`),
    INDEX `PnpExtratorFato_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PnpMicrodadoCiclo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `anoBase` SMALLINT NOT NULL,
    `ciclo` VARCHAR(20) NOT NULL,
    `coInst` VARCHAR(20) NOT NULL DEFAULT '',
    `codUnidade` VARCHAR(20) NOT NULL DEFAULT '',
    `codUnidadeSistec` VARCHAR(20) NOT NULL DEFAULT '',
    `instituicao` VARCHAR(60) NOT NULL DEFAULT '',
    `unidadeEnsino` VARCHAR(191) NOT NULL DEFAULT '',
    `uf` VARCHAR(4) NOT NULL DEFAULT '',
    `codMunicipio` VARCHAR(12) NOT NULL DEFAULT '',
    `cursoEmec` VARCHAR(20) NOT NULL DEFAULT '',
    `nomeCurso` VARCHAR(255) NOT NULL DEFAULT '',
    `tipoCurso` VARCHAR(80) NOT NULL DEFAULT '',
    `tipoOferta` VARCHAR(60) NOT NULL DEFAULT '',
    `modalidade` VARCHAR(60) NOT NULL DEFAULT '',
    `fonteFinanciamento` VARCHAR(100) NOT NULL DEFAULT '',
    `programa` VARCHAR(150) NOT NULL DEFAULT '',
    `eixo` VARCHAR(120) NOT NULL DEFAULT '',
    `subeixo` VARCHAR(120) NOT NULL DEFAULT '',
    `turno` VARCHAR(30) NOT NULL DEFAULT '',
    `formacaoProfessores` BOOLEAN NOT NULL DEFAULT false,
    `cargaHoraria` INTEGER NULL,
    `cargaHorariaMinima` INTEGER NULL,
    `fatorEsforco` DECIMAL(10, 4) NULL,
    `inicio` DATE NULL,
    `fimPrevisto` DATE NULL,
    `vagas` INTEGER NULL,
    `inscritos` INTEGER NULL,
    `matriculas` INTEGER NOT NULL,
    `atendidas` INTEGER NOT NULL,
    `porSituacao` JSON NOT NULL,
    `porRenda` JSON NOT NULL,
    `instituicaoId` INTEGER NULL,
    `unidadeId` INTEGER NULL,

    INDEX `PnpMicrodadoCiclo_tipo_anoBase_instituicao_idx`(`tipo`, `anoBase`, `instituicao`),
    INDEX `PnpMicrodadoCiclo_ciclo_idx`(`ciclo`),
    INDEX `PnpMicrodadoCiclo_unidadeId_anoBase_idx`(`unidadeId`, `anoBase`),
    INDEX `PnpMicrodadoCiclo_instituicaoId_anoBase_idx`(`instituicaoId`, `anoBase`),
    INDEX `PnpMicrodadoCiclo_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PnpMicrodadoFinanceiro` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `anoBase` SMALLINT NOT NULL,
    `unidadeOrcamentaria` VARCHAR(20) NOT NULL,
    `acao` VARCHAR(20) NOT NULL,
    `gnd` VARCHAR(10) NOT NULL,
    `liquidacoes` DECIMAL(18, 2) NOT NULL,

    INDEX `PnpMicrodadoFinanceiro_anoBase_unidadeOrcamentaria_idx`(`anoBase`, `unidadeOrcamentaria`),
    INDEX `PnpMicrodadoFinanceiro_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PnpMicrodadoServidor` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fonteDadosId` INTEGER NOT NULL,
    `anoBase` SMALLINT NOT NULL,
    `codUnidade` VARCHAR(20) NOT NULL DEFAULT '',
    `codUnidadeSistec` VARCHAR(20) NOT NULL DEFAULT '',
    `instituicao` VARCHAR(60) NOT NULL DEFAULT '',
    `unidadeLotacao` VARCHAR(191) NOT NULL DEFAULT '',
    `municipio` VARCHAR(120) NOT NULL DEFAULT '',
    `codMunicipio` VARCHAR(12) NOT NULL DEFAULT '',
    `regiao` VARCHAR(30) NOT NULL DEFAULT '',
    `classe` VARCHAR(20) NOT NULL DEFAULT '',
    `jornada` VARCHAR(20) NOT NULL DEFAULT '',
    `rsc` VARCHAR(40) NOT NULL DEFAULT '',
    `titulacao` VARCHAR(60) NOT NULL DEFAULT '',
    `vinculoCarreira` VARCHAR(40) NOT NULL DEFAULT '',
    `vinculoContrato` VARCHAR(40) NOT NULL DEFAULT '',
    `vinculoProfessor` VARCHAR(10) NOT NULL DEFAULT '',
    `registros` INTEGER NOT NULL,

    INDEX `PnpMicrodadoServidor_anoBase_instituicao_idx`(`anoBase`, `instituicao`),
    INDEX `PnpMicrodadoServidor_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PnpOrcamentoFato` ADD CONSTRAINT `PnpOrcamentoFato_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpOrcamentoFato` ADD CONSTRAINT `PnpOrcamentoFato_estruturaId_fkey` FOREIGN KEY (`estruturaId`) REFERENCES `PnpEstrutura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpExtratorFato` ADD CONSTRAINT `PnpExtratorFato_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpMicrodadoCiclo` ADD CONSTRAINT `PnpMicrodadoCiclo_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpMicrodadoFinanceiro` ADD CONSTRAINT `PnpMicrodadoFinanceiro_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PnpMicrodadoServidor` ADD CONSTRAINT `PnpMicrodadoServidor_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

