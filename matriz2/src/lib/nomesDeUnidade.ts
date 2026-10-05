/**
 * Câmpus que mudaram de nome. A MDO ainda escreve o nome antigo nos arquivos; o sistema guarda e mostra o nome atual.
 * O Câmpus Avançado Novo Hamburgo (IFSul) deixou de ser avançado (confirmado pelo usuário em 2026-10-05).
 * Toda carga que procura ou cria uma unidade pelo nome do arquivo passa o nome por aqui, para não duplicar a unidade.
 */
const NOME_ATUAL: Record<string, string> = {
  "CAMPUS AVANÇADO NOVO HAMBURGO": "CAMPUS NOVO HAMBURGO",
};

/** O nome atual da unidade, dado o nome como veio no arquivo (qualquer caixa); nomes sem mudança voltam como estavam. */
export function nomeCanonicoDaUnidade(nome: string): string {
  return NOME_ATUAL[nome.trim().toUpperCase()] ?? nome;
}
