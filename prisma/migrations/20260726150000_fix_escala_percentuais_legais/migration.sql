-- Registra correções pontuais de dados já aplicadas em FatoIndicador (bugs de escala/valor
-- confirmados nos exports da PNP), para que este tipo de migration possa checar "já apliquei essa
-- correção?" antes de rodar. Necessário porque, para esta correção especificamente, as faixas de
-- valor corrigido e valor ainda inflado se sobrepõem (ex.: um valor correto de ~32.925 convive com
-- o que seria um valor pequeno ainda inflado) — não dá para detectar "já corrigido" só pela
-- magnitude do valor, então a idempotência precisa de um marcador explícito.
CREATE TABLE IF NOT EXISTS `DataFixLog` (
    `id` VARCHAR(191) NOT NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Corrige o bug de escala 100x em PercentuaisLegais.csv: os 4 valores de "Matrícula Equivalente"
-- (Geral/Técnicos/Formação de Professores/Proeja) vêm 100x maiores que o valor real neste export
-- da PNP (Achado 6 de docs/pnp-matriz/Comparacao_CSV_vs_Matriz_5aFase.md; a mesma correção já foi
-- aplicada na leitura via `parseDecimalBrOptionalEscala100`, ver
-- src/ingestion/parsing/transforms.ts). Esta migration replica a correção para os dados já
-- ingeridos antes dessa mudança — mesmo filtro (fileType + as 4 medidas) usado na correção manual
-- de 18.479 registros em matriz_dev (2026-07-26).
--
-- Idempotente: só divide se a chave abaixo ainda não estiver marcada como aplicada. Rodar este
-- arquivo mais de uma vez (ou aplicá-lo numa base que já recebeu a correção por outro meio, com o
-- marcador devidamente inserido) não divide os valores por 100 de novo.
UPDATE `FatoIndicador`
SET `valor` = `valor` / 100
WHERE `fileType` = 'PERCENTUAIS_LEGAIS'
  AND `medida` IN (
    'Matrícula Equivalente | Técnicos',
    'Matrícula Equivalente | Formação de Professores',
    'Matrícula Equivalente | Proeja',
    'Matrícula Equivalente | Geral'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `DataFixLog` WHERE `id` = 'percentuais_legais_escala100_2026_07'
  );

INSERT IGNORE INTO `DataFixLog` (`id`) VALUES ('percentuais_legais_escala100_2026_07');
