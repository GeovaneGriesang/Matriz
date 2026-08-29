-- Remove a estrategia FORPLAN_2025 do enum. Conferido antes de aplicar: nenhum OrcamentoAnual usa
-- esse valor (todos em PLANILHA_2026), entao a conversao nao perde dado. A tabela do livro
-- CONIF/Forplan 2025 nao corresponde a nenhum ciclo que o sistema calcula - manter selecionavel so
-- oferecia uma forma de errar.
ALTER TABLE `OrcamentoAnual` MODIFY `estrategiaFaixasIea` ENUM('PLANILHA_2026', 'PLANILHA_2027') NOT NULL DEFAULT 'PLANILHA_2026';
