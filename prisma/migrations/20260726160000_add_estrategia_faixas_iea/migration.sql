-- AlterTable
-- Duas fontes oficiais documentam faixas/pesos de IEA diferentes (planilha-modelo do ciclo 2026 x
-- livro Forplan/2025); nenhuma é descartada — este campo só escolhe qual delas o cálculo oficial
-- de cada ano usa (ver src/calculation-engine/constants/qualidadeEficiencia.constants.ts).
ALTER TABLE `OrcamentoAnual` ADD COLUMN `estrategiaFaixasIea` ENUM('PLANILHA_2026', 'FORPLAN_2025') NOT NULL DEFAULT 'PLANILHA_2026';
