-- AlterTable
-- Dedução sobre `valorTotal` (Custeio 20RL Bruto) ANTES de dividir em Funcionamento 80% /
-- Reitorias 10% / Qualidade e Eficiência 10% — ver OrcamentoAnual.ajuste no schema (Prompt 10:
-- resolvido contra os números reais do sistema, não o valor bruto de DADOS BASE!M26 da planilha).
ALTER TABLE `OrcamentoAnual` ADD COLUMN `ajuste` DECIMAL(18, 2) NOT NULL DEFAULT 0 AFTER `valorTotal`;
