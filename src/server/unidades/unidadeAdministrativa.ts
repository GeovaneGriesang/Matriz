/**
 * Reitoria/Direção Geral são unidades **administrativas**: não têm matrícula, não têm Bloco
 * Funcionamento e não são elegíveis ao Piso Mínimo por Câmpus Novo. Identificadas pelo nome porque a
 * PNP não as distingue por um campo próprio — o padrão do nome se repete em todas as ~40
 * instituições ingeridas ("Reitoria do ...", "Direção Geral do ...").
 *
 * Regra única do sistema: usada pela tela de ano de criação (`/api/unidades`), pelo cadastro manual
 * de câmpus (`actions/unidade.ts`) e pela criação automática de câmpus a partir da planilha de
 * Matrícula Total equalizada (`actions/matriculaTotalEqualizadaAnual.ts`). Antes existiam duas
 * cópias do mesmo regex; a criação automática seria a terceira, e três definições de "o que é um
 * câmpus" divergiriam em silêncio.
 */
export function ehUnidadeAdministrativa(nome: string): boolean {
  return /^(reitoria|direção geral|direcao geral)\b/i.test(nome);
}
