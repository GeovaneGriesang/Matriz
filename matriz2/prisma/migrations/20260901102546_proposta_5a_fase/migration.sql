/*
  Warnings:

  - You are about to drop the column `piso` on the `DistribuicaoCampus` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `DistribuicaoCampus` DROP COLUMN `piso`,
    ADD COLUMN `elegivelPiso` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `vlMatrFinal` DECIMAL(18, 6) NULL;

-- AlterTable
ALTER TABLE `DistribuicaoInstituicao` ADD COLUMN `aplFormacaoProfessor` DECIMAL(18, 6) NULL,
    ADD COLUMN `aplProeja` DECIMAL(18, 6) NULL,
    ADD COLUMN `aplProejaPonderado` DECIMAL(18, 6) NULL,
    ADD COLUMN `aplTecnico` DECIMAL(18, 6) NULL,
    ADD COLUMN `aplTecnicoPonderado` DECIMAL(18, 6) NULL,
    ADD COLUMN `ialEqualizado` DECIMAL(18, 6) NULL,
    ADD COLUMN `ialPonderado` DECIMAL(18, 6) NULL,
    ADD COLUMN `ieaPonderado` DECIMAL(18, 6) NULL,
    ADD COLUMN `matrEquivalente` DECIMAL(18, 6) NULL,
    ADD COLUMN `rapEqualizado` DECIMAL(18, 6) NULL,
    ADD COLUMN `rapEquivalente` DECIMAL(18, 6) NULL,
    ADD COLUMN `rapMecPresencial` DECIMAL(18, 6) NULL,
    ADD COLUMN `rapPonderado` DECIMAL(18, 6) NULL,
    ADD COLUMN `rapPresencial` DECIMAL(18, 6) NULL;
