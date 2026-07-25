-- AlterTable
ALTER TABLE `OrcamentoAnual` ADD COLUMN `pisoMinimoCampusNovo` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Unidade` ADD COLUMN `anoCriacao` INTEGER NULL;
