-- AlterTable: OrcamentoAnual volta a ser um único valor por ano (não mais por instituição) —
-- o mesmo orçamento é usado no cálculo de todas as instituições com dados PNP disponíveis.
ALTER TABLE `OrcamentoAnual` DROP FOREIGN KEY `OrcamentoAnual_instituicaoId_fkey`;

ALTER TABLE `OrcamentoAnual` DROP INDEX `OrcamentoAnual_ano_instituicaoId_key`;

ALTER TABLE `OrcamentoAnual` DROP INDEX `OrcamentoAnual_instituicaoId_idx`;

ALTER TABLE `OrcamentoAnual` DROP COLUMN `instituicaoId`;

CREATE UNIQUE INDEX `OrcamentoAnual_ano_key` ON `OrcamentoAnual`(`ano`);
