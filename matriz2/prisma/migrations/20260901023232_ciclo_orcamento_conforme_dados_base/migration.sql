/*
  Warnings:

  - You are about to drop the column `custeioTotal` on the `CicloOrcamento` table. All the data in the column will be lost.
  - You are about to alter the column `percentualAnuidade` on the `CicloOrcamento` table. The data in that column could be lost. The data in that column will be cast from `Decimal(7,4)` to `Decimal(9,6)`.
  - Added the required column `funcionamentoTotal` to the `CicloOrcamento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valorReferenciaSpo` to the `CicloOrcamento` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `CicloOrcamento` DROP COLUMN `custeioTotal`,
    ADD COLUMN `funcionamentoTotal` DECIMAL(18, 2) NOT NULL,
    ADD COLUMN `pisoTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `qualidadeEficienciaTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `reitoriasTotal` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `valorIapl` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `valorIea` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `valorMatriculaEad` DECIMAL(18, 6) NULL,
    ADD COLUMN `valorMatriculaEadFp` DECIMAL(18, 6) NULL,
    ADD COLUMN `valorMatriculaEadMooc` DECIMAL(18, 6) NULL,
    ADD COLUMN `valorMatriculaPresencial` DECIMAL(18, 6) NULL,
    ADD COLUMN `valorRap` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `valorReferenciaSpo` DECIMAL(18, 2) NOT NULL,
    MODIFY `percentualAnuidade` DECIMAL(9, 6) NOT NULL DEFAULT 0;
