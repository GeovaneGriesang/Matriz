-- AlterTable: OrcamentoAnual passa a ser por (ano, instituicao) em vez de único por ano.
-- Backfill: orçamentos já cadastrados eram implicitamente do IFSUL (único fluxo existente até aqui).
ALTER TABLE `OrcamentoAnual` DROP INDEX `OrcamentoAnual_ano_key`;

ALTER TABLE `OrcamentoAnual` ADD COLUMN `instituicaoId` INTEGER NULL;

UPDATE `OrcamentoAnual`
SET `instituicaoId` = (SELECT `id` FROM `Instituicao` WHERE `sigla` = 'IFSUL' LIMIT 1);

ALTER TABLE `OrcamentoAnual` MODIFY COLUMN `instituicaoId` INTEGER NOT NULL;

CREATE UNIQUE INDEX `OrcamentoAnual_ano_instituicaoId_key` ON `OrcamentoAnual`(`ano`, `instituicaoId`);

CREATE INDEX `OrcamentoAnual_instituicaoId_idx` ON `OrcamentoAnual`(`instituicaoId`);

ALTER TABLE `OrcamentoAnual` ADD CONSTRAINT `OrcamentoAnual_instituicaoId_fkey` FOREIGN KEY (`instituicaoId`) REFERENCES `Instituicao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
