-- AlterTable: acrescenta a estrategia de faixas de IEA do ciclo 2027 (media de rede 49,0%).
ALTER TABLE `OrcamentoAnual` MODIFY `estrategiaFaixasIea` ENUM('PLANILHA_2026', 'FORPLAN_2025', 'PLANILHA_2027') NOT NULL DEFAULT 'PLANILHA_2026';
