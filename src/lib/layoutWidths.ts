/**
 * Larguras de página compartilhadas — evita duplicar a mesma classe em cada
 * page.tsx/layout.tsx (isso já causou retrabalho no passado, ver commit
 * 70c3a73). Duas faixas: formulários (poucos campos, mais fácil de ler
 * estreito) e telas de tabela (se beneficiam de mais espaço em monitores
 * largos).
 */
export const FORM_MAX_WIDTH = "max-w-3xl";
export const TABLE_MAX_WIDTH = "max-w-screen-2xl";
