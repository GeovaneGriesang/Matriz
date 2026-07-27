-- CreateTable
CREATE TABLE `EficienciaAcademicaAnual` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `instituicaoId` INTEGER NOT NULL,
    `ano` INTEGER NOT NULL,
    `conclusaoCiclo` DECIMAL(18, 6) NOT NULL,
    `evasaoCiclo` DECIMAL(18, 6) NOT NULL,
    `retencaoCiclo` DECIMAL(18, 6) NOT NULL,
    `eficienciaAcademica` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EficienciaAcademicaAnual_ano_idx`(`ano`),
    UNIQUE INDEX `EficienciaAcademicaAnual_instituicaoId_ano_key`(`instituicaoId`, `ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EficienciaAcademicaAnual` ADD CONSTRAINT `EficienciaAcademicaAnual_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
