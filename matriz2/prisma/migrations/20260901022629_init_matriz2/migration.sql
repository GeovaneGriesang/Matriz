-- CreateTable
CREATE TABLE `FonteDados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `origem` ENUM('PNP', 'MDO_IFTM', 'CALCULADO', 'ADMINISTRADOR') NOT NULL,
    `fase` ENUM('F1A_OBTENCAO', 'F1B_IMPORTACAO', 'F2_CONFERENCIA_EXTRACAO', 'F3_PARAMETROS_CAMPUS', 'F4_CHECAGEM_MATRICULAS', 'F5_PROPOSTA', 'F6_PARTICIPACAO') NULL,
    `cicloOrcamento` INTEGER NOT NULL,
    `arquivo` VARCHAR(191) NOT NULL,
    `geradoEm` DATETIME(3) NULL,
    `carregadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `abrangencia` ENUM('REDE', 'INSTITUICAO', 'CAMPUS') NOT NULL,
    `instituicaoId` INTEGER NULL,
    `checksum` CHAR(64) NULL,
    `ressalva` TEXT NULL,

    INDEX `FonteDados_cicloOrcamento_origem_idx`(`cicloOrcamento`, `origem`),
    INDEX `FonteDados_instituicaoId_idx`(`instituicaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Instituicao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sigla` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `uf` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Instituicao_sigla_key`(`sigla`),
    INDEX `Instituicao_uf_idx`(`uf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unidade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `tipo` ENUM('CAMPUS', 'REITORIA') NOT NULL DEFAULT 'CAMPUS',
    `anoCriacao` INTEGER NULL,

    INDEX `Unidade_instituicaoId_idx`(`instituicaoId`),
    UNIQUE INDEX `Unidade_instituicaoId_nome_key`(`instituicaoId`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CicloOrcamento` (
    `ano` INTEGER NOT NULL,
    `custeioTotal` DECIMAL(18, 2) NOT NULL,
    `ajuste` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `assistenciaTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `pisoPorCampus` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `campusComPiso` INTEGER NOT NULL DEFAULT 0,
    `percentualAnuidade` DECIMAL(7, 4) NOT NULL DEFAULT 0,
    `fonteDadosId` INTEGER NOT NULL,

    INDEX `CicloOrcamento_fonteDadosId_idx`(`fonteDadosId`),
    PRIMARY KEY (`ano`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DistribuicaoCiclo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `unidadeId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `codigoCiclo` VARCHAR(191) NOT NULL,
    `ciclo` TEXT NOT NULL,
    `curso` VARCHAR(191) NOT NULL,
    `areaEixo` VARCHAR(191) NULL,
    `nivel` VARCHAR(191) NULL,
    `tipoCurso` VARCHAR(191) NULL,
    `tipoOferta` VARCHAR(191) NULL,
    `turno` VARCHAR(191) NULL,
    `modalidade` VARCHAR(191) NOT NULL,
    `fonteFinanciamento` VARCHAR(191) NOT NULL,
    `repasse` ENUM('PRESENCIAL', 'EAD', 'EAD_MOOC', 'EAD_FP') NOT NULL,
    `inicio` DATETIME(3) NULL,
    `termino` DATETIME(3) NULL,
    `jubilamento` DATETIME(3) NULL,
    `pesoCursoMatriz` DECIMAL(10, 4) NULL,
    `chMinimaMec` INTEGER NULL,
    `cargaHoraria` INTEGER NULL,
    `chMatriz` INTEGER NULL,
    `qtdAlunosMatriz` DECIMAL(18, 5) NULL,
    `matriculaTotal` DECIMAL(18, 6) NOT NULL,
    `valorReais` DECIMAL(18, 6) NOT NULL,
    `icqa` DECIMAL(18, 6) NULL,
    `valorAluno` DECIMAL(18, 6) NULL,
    `perdaEvasaoReais` DECIMAL(18, 6) NULL,

    INDEX `DistribuicaoCiclo_ano_unidadeId_idx`(`ano`, `unidadeId`),
    INDEX `DistribuicaoCiclo_ano_repasse_idx`(`ano`, `repasse`),
    INDEX `DistribuicaoCiclo_curso_idx`(`curso`),
    INDEX `DistribuicaoCiclo_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `DistribuicaoCiclo_ano_unidadeId_codigoCiclo_key`(`ano`, `unidadeId`, `codigoCiclo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DistribuicaoCampus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `unidadeId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `piso` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `matrPresencialAjustada` DECIMAL(18, 6) NULL,
    `matrEadAjustada` DECIMAL(18, 6) NULL,
    `qtAlPresencial` DECIMAL(18, 5) NULL,
    `qtAlEad` DECIMAL(18, 5) NULL,
    `qtAlMooc` DECIMAL(18, 5) NULL,
    `qtAlEadFp` DECIMAL(18, 5) NULL,
    `mtPresencial` DECIMAL(18, 6) NULL,
    `mtEad` DECIMAL(18, 6) NULL,
    `mtEadMooc` DECIMAL(18, 6) NULL,
    `mtEadFp` DECIMAL(18, 6) NULL,
    `vlMatrizPresencial` DECIMAL(18, 6) NULL,
    `vlMatrizEad` DECIMAL(18, 6) NULL,
    `vlMatrizEadMooc` DECIMAL(18, 6) NULL,
    `vlMatrizEadFp` DECIMAL(18, 6) NULL,
    `aePresencial` DECIMAL(18, 6) NULL,
    `aeEad` DECIMAL(18, 6) NULL,
    `aeRip` DECIMAL(18, 6) NULL,

    INDEX `DistribuicaoCampus_ano_idx`(`ano`),
    INDEX `DistribuicaoCampus_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `DistribuicaoCampus_ano_unidadeId_key`(`ano`, `unidadeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DistribuicaoInstituicao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ano` INTEGER NOT NULL,
    `instituicaoId` INTEGER NOT NULL,
    `fonteDadosId` INTEGER NOT NULL,
    `vlMatr` DECIMAL(18, 6) NULL,
    `vlIea` DECIMAL(18, 6) NULL,
    `vlRap` DECIMAL(18, 6) NULL,
    `vlIapl` DECIMAL(18, 6) NULL,
    `matrizCusteio` DECIMAL(18, 6) NULL,
    `matrizAe` DECIMAL(18, 6) NULL,
    `anuidadeConif` DECIMAL(18, 6) NULL,
    `porcentagem` DECIMAL(12, 8) NULL,
    `ieaConclusao` DECIMAL(18, 6) NULL,
    `ieaEvasao` DECIMAL(18, 6) NULL,
    `ieaRetencao` DECIMAL(18, 6) NULL,
    `ieaEficiencia` DECIMAL(18, 6) NULL,
    `ieaEqualizado` DECIMAL(18, 6) NULL,

    INDEX `DistribuicaoInstituicao_ano_idx`(`ano`),
    INDEX `DistribuicaoInstituicao_fonteDadosId_idx`(`fonteDadosId`),
    UNIQUE INDEX `DistribuicaoInstituicao_ano_instituicaoId_key`(`ano`, `instituicaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FonteDados` ADD CONSTRAINT `FonteDados_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Unidade` ADD CONSTRAINT `Unidade_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CicloOrcamento` ADD CONSTRAINT `CicloOrcamento_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DistribuicaoCiclo` ADD CONSTRAINT `DistribuicaoCiclo_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DistribuicaoCiclo` ADD CONSTRAINT `DistribuicaoCiclo_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DistribuicaoCampus` ADD CONSTRAINT `DistribuicaoCampus_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `Unidade`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DistribuicaoCampus` ADD CONSTRAINT `DistribuicaoCampus_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DistribuicaoInstituicao` ADD CONSTRAINT `DistribuicaoInstituicao_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DistribuicaoInstituicao` ADD CONSTRAINT `DistribuicaoInstituicao_fonteDadosId_fkey` FOREIGN KEY (`fonteDadosId`) REFERENCES `FonteDados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
