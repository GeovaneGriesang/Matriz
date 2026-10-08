/**
 * A comissão que estuda e analisa a matriz orçamentária no IFSul, para o rodapé do site. Os dados vêm da portaria que a designou; o PDF da
 * portaria fica em `public/documentos` e é o que o rodapé oferece para baixar. Só nome e segmento aparecem na tela (o número do Siape fica só
 * no PDF, que é o ato oficial).
 */

export const PORTARIA_DA_COMISSAO = {
  numero: "1284",
  data: "21 de maio de 2026",
  processo: "23356.000371.2026-12",
  titulo: "Comissão de Estudos e Análise da Matriz Orçamentária do IFSul, Câmpus Venâncio Aires",
  /** Caminho do PDF dentro de `public/`. */
  arquivo: "/documentos/portaria-1284-2026-comissao-matriz-orcamentaria.pdf",
  /** Nome sugerido ao salvar. */
  nomeParaSalvar: "Portaria 1284-2026 - Comissão da matriz orçamentária.pdf",
} as const;

export interface MembroDaComissao {
  nome: string;
  segmento: "Docente" | "TAE";
  /** Quem preside a comissão (o primeiro da portaria). */
  presidente?: boolean;
}

/** Na ordem da portaria: o primeiro nome preside. */
export const MEMBROS_DA_COMISSAO: readonly MembroDaComissao[] = [
  { nome: "Geovane Griesang", segmento: "Docente", presidente: true },
  { nome: "Kalien Alves Klimeck", segmento: "Docente" },
  { nome: "Angelita da Rosa", segmento: "Docente" },
  { nome: "Everton da Silva Felix", segmento: "Docente" },
  { nome: "Carolina Jantsch de Souza", segmento: "TAE" },
  { nome: "Fernanda Machado", segmento: "TAE" },
  { nome: "Juliano Rafael Petersen", segmento: "TAE" },
  { nome: "Daiana Schons", segmento: "TAE" },
  { nome: "Fernanda Schwinden Dallamico Kirst", segmento: "TAE" },
];
